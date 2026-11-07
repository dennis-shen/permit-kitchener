"""Open uploads, detect format problems, extract text lines with positions (vector or OCR)."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field

import numpy as np
import pymupdf as fitz

from . import ocr


@dataclass
class Line:
    text: str
    page: int
    bbox: tuple[float, float, float, float]  # PDF points, origin top-left
    conf: float
    source: str  # "vector" | "ocr"


@dataclass
class PageImage:
    page: int
    width: float
    height: float
    gray: np.ndarray  # 150-dpi grayscale render, used by OpenCV detectors
    scale: float  # pixels per point


@dataclass
class Upload:
    filename: str
    data: bytes
    sha256: str = ""
    kind: str = "unknown"  # pdf | image | other
    problem: str | None = None  # FileFindingCode
    doc: fitz.Document | None = None
    lines: list[Line] = field(default_factory=list)
    images: list[PageImage] = field(default_factory=list)
    ocr_conf: float | None = None

    @property
    def text(self) -> str:
        return "\n".join(l.text for l in self.lines)

    def page_text(self, page: int) -> str:
        return "\n".join(l.text for l in self.lines if l.page == page)


def sniff(data: bytes) -> str:
    if data[:5] == b"%PDF-":
        return "pdf"
    if data[:8] == b"\x89PNG\r\n\x1a\n" or data[:3] == b"\xff\xd8\xff":
        return "image"
    if b"%PDF-" in data[:1024]:
        return "pdf"
    return "other"


def load(filename: str, data: bytes) -> Upload:
    up = Upload(filename=filename, data=data, sha256=hashlib.sha256(data).hexdigest())
    up.kind = sniff(data)
    if up.kind == "other":
        # Corrupt PDFs (bad header) are unreadable rather than the wrong format.
        up.problem = "UNREADABLE" if filename.lower().endswith(".pdf") else "WRONG_FORMAT"
        return up
    try:
        doc = fitz.open(stream=data, filetype="pdf" if up.kind == "pdf" else None)
    except Exception:
        up.problem = "UNREADABLE"
        return up
    if doc.needs_pass or doc.is_encrypted:
        up.problem = "PASSWORD_PROTECTED"
        return up
    if up.kind == "image":
        doc = fitz.open("pdf", doc.convert_to_pdf())
    try:
        if doc.page_count == 0:
            raise ValueError("empty")
        up.doc = doc
        _extract(up)
    except Exception:
        up.problem = "UNREADABLE"
    return up


def _extract(up: Upload) -> None:
    assert up.doc is not None
    confs: list[float] = []
    for i, page in enumerate(up.doc, start=1):
        pix = page.get_pixmap(dpi=150, colorspace=fitz.csGRAY)
        gray = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width).copy()
        scale = 150 / 72
        up.images.append(PageImage(i, page.rect.width, page.rect.height, gray, scale))

        vector = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                t = " ".join(s["text"] for s in line["spans"]).strip()
                if t:
                    vector.append(Line(t, i, tuple(line["bbox"]), 1.0, "vector"))
        if sum(len(l.text) for l in vector) >= 20:
            up.lines += vector
            continue
        # Scanned page → OpenCV clean-up + Tesseract.
        lines, conf = ocr.read_page(page, i)
        up.lines += lines
        if conf is not None:
            confs.append(conf)
    if confs:
        up.ocr_conf = sum(confs) / len(confs)


VAGUE_NAME = re.compile(r"^(scan|img|image|doc|document|file|untitled|new|page|copy)[\s_\-]*\d*$|^\d+$", re.I)


def vague_name(filename: str) -> bool:
    stem = re.sub(r"\.[a-z0-9]+$", "", filename, flags=re.I)
    return bool(VAGUE_NAME.match(stem.strip()))


def normalised_name(filename: str) -> str:
    stem = re.sub(r"\.[a-z0-9]+$", "", filename, flags=re.I).lower()
    stem = re.sub(r"\s*\(\d+\)$|[\s_\-]*(copy|final|v\d+)$", "", stem)
    return re.sub(r"[^a-z0-9]", "", stem)
