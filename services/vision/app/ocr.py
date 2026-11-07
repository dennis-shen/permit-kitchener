"""Scanned-page reading: OpenCV clean-up (deskew, denoise, threshold) then Tesseract."""
from __future__ import annotations

import os

import cv2
import numpy as np
import pymupdf as fitz

DPI = 300


def deskew(gray: np.ndarray) -> tuple[np.ndarray, float]:
    """Estimate skew from long near-horizontal lines (drawing borders) and rotate it out."""
    inv = cv2.bitwise_not(gray)
    _, bw = cv2.threshold(inv, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    lines = cv2.HoughLinesP(bw, 1, np.pi / 1800, threshold=200, minLineLength=gray.shape[1] // 4, maxLineGap=10)
    angle = 0.0
    if lines is not None:
        angs = []
        for x1, y1, x2, y2 in lines.reshape(-1, 4):
            a = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            if abs(a) < 5:
                angs.append(a)
        if angs:
            angle = float(np.median(angs))
    if abs(angle) < 0.1:
        return gray, 0.0
    h, w = gray.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=255), angle


def clean(gray: np.ndarray) -> np.ndarray:
    den = cv2.fastNlMeansDenoising(gray, None, h=15, templateWindowSize=7, searchWindowSize=21)
    return cv2.adaptiveThreshold(den, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)


def read_page(page: fitz.Page, page_no: int):
    from .ingest import Line  # avoid cycle

    try:
        import pytesseract
    except ImportError:  # pragma: no cover
        return [], None
    pix = page.get_pixmap(dpi=DPI, colorspace=fitz.csGRAY)
    gray = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width).copy()
    gray, _ = deskew(gray)
    img = clean(gray)
    lang = os.getenv("OCR_LANG", "eng")
    try:
        data = pytesseract.image_to_data(img, lang=lang, config="--psm 11", output_type=pytesseract.Output.DICT)
    except Exception:  # tesseract missing
        return [], None
    k = 72 / DPI
    words = [
        (data["text"][i].strip(), float(data["conf"][i]), data["left"][i], data["top"][i], data["width"][i], data["height"][i])
        for i in range(len(data["text"]))
        if data["text"][i].strip() and float(data["conf"][i]) > 0
    ]
    # Group words into lines by vertical position, then split on large horizontal gaps.
    words.sort(key=lambda w: (round(w[3] / 18), w[2]))
    lines: list = []
    cur: list = []
    for w in words:
        if cur and (abs(w[3] - cur[-1][3]) > 12 or w[2] - (cur[-1][2] + cur[-1][4]) > 60):
            lines.append(cur)
            cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    out, confs = [], []
    for ws in lines:
        x0 = min(w[2] for w in ws); y0 = min(w[3] for w in ws)
        x1 = max(w[2] + w[4] for w in ws); y1 = max(w[3] + w[5] for w in ws)
        c = sum(w[1] for w in ws) / len(ws) / 100
        confs.append(c)
        out.append(Line(" ".join(w[0] for w in ws), page_no, (x0 * k, y0 * k, x1 * k, y1 * k), c, "ocr"))
    return out, (sum(confs) / len(confs) if confs else None)
