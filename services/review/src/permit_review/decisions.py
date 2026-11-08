"""PDF pages -> PNG images -> local AI SDK bridge. No OCR, text extraction or field values."""
from __future__ import annotations

import base64
import json
import urllib.error
import urllib.request

import pymupdf

MAX_PAGES = 60
MAX_SIDE = 3072
BATCH_PAGES = 4
MAX_BATCH_BYTES = 24 * 1024 * 1024


class DocumentProblem(ValueError):
    def __init__(self, code: str):
        self.code = code


class DecisionsUnavailable(RuntimeError):
    pass


def call_decisions(images: list[str], submission: dict, document_type: str) -> dict[str, bool]:
    app = submission.get("application") or {}
    # Do not send applicant/owner/contact values, previously asserted fields or file names as evidence.
    payload = {"images": images, "project_type": app.get("project_type"), "document_type": document_type,
               "project_attributes": submission.get("project_attributes") or {},
               "expected_address": app.get("property_address", "")}
    req = urllib.request.Request("http://127.0.0.1:8101/decisions", data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        # Localhost must not go through an outbound credential proxy.
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=70) as response:
            out = json.loads(response.read(128 * 1024))
        if not isinstance(out, dict) or not out or any(type(v) is not bool for v in out.values()):
            raise DecisionsUnavailable()
        return out
    except (OSError, ValueError, urllib.error.URLError) as exc:
        raise DecisionsUnavailable() from exc


def inspect_pdf(data: bytes, submission: dict, document_type: str) -> dict[str, bool]:
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise DocumentProblem("UNREADABLE") from exc
    with doc:
        if doc.is_encrypted:
            raise DocumentProblem("PASSWORD_PROTECTED")
        if not 0 < len(doc) <= MAX_PAGES:
            raise DocumentProblem("UNREADABLE")
        combined: dict[str, bool] = {}
        batch: list[str] = []
        batch_size = 0

        def flush():
            nonlocal batch, batch_size
            if not batch:
                return
            answers = call_decisions(batch, submission, document_type)
            if combined and set(answers) != set(combined):
                raise DecisionsUnavailable()
            for key, value in answers.items():
                # Presence can be on any page; an explicit contradiction anywhere still matters.
                if key in ("file.address_consistent", "file.labelled"):
                    combined[key] = combined.get(key, True) and value
                else:
                    combined[key] = combined.get(key, False) or value
            batch, batch_size = [], 0

        for page in doc:
            try:
                longest = max(page.rect.width, page.rect.height)
                if longest <= 0:
                    raise ValueError("Invalid page dimensions")
                scale = min(2.5, MAX_SIDE / longest)
                png = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csRGB,
                                     alpha=False, annots=True).tobytes("png")
            except Exception as exc:
                raise DocumentProblem("UNREADABLE") from exc
            encoded = base64.b64encode(png).decode("ascii")
            if len(encoded) > MAX_BATCH_BYTES // 2:
                raise DocumentProblem("UNREADABLE")
            if batch and (len(batch) == BATCH_PAGES or batch_size + len(encoded) > MAX_BATCH_BYTES):
                previous = batch[-1]
                flush()
                # Keep every adjacent pair together, including across byte-limit boundaries.
                batch, batch_size = [previous], len(previous)
            batch.append(encoded)
            batch_size += len(encoded)
        flush()
        return combined
