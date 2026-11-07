"""Registry of detail checks. Each detail's `vision.check` (in data/requirements/*.json) picks one.

To add a new kind of check (for example reading a field from the Ontario permit form):
    @register("my_check")
    def my_check(up, det):  # det is a config.DetailCheck
        ...return evidence dict or None
then set `"vision": {"check": "my_check", ...}` on the detail in JSON.
"""
from __future__ import annotations

import re
from typing import Callable

from rapidfuzz import fuzz

from . import detectors
from .config import DetailCheck
from .ingest import Line, Upload

Check = Callable[[Upload, DetailCheck], "dict | None"]
CHECKS: dict[str, Check] = {}


def register(name: str):
    def wrap(fn: Check) -> Check:
        CHECKS[name] = fn
        return fn
    return wrap


def ev(up: Upload, page: int, bbox=None, *, quote=None, conf=1.0, source="rule", expected=False, value=None) -> dict:
    e: dict = {"filename": up.filename, "page": page, "confidence": round(conf, 3), "source": source, "expectedRegion": expected}
    if bbox:
        e["bbox"] = [round(float(v), 1) for v in bbox]
    if quote:
        e["quote"] = quote
    if value is not None:
        e["value"] = value
    return e


def find_line(up: Upload, rx: re.Pattern) -> Line | None:
    for l in up.lines:
        if rx.search(l.text):
            return l
    return None


def hint_line(up: Upload, hints: list[str]) -> Line | None:
    for l in up.lines:
        for h in hints:
            if len(h) > 3 and fuzz.partial_ratio(h.lower(), l.text.lower()) >= 90:
                return l
    return None


@register("text")
def text_check(up: Upload, det: DetailCheck) -> dict | None:
    """Any regex pattern matches (per line, then whole document for multi-line patterns); else fuzzy hints."""
    if det.patterns:
        for rx in det.patterns:
            l = find_line(up, rx)
            if l:
                return ev(up, l.page, l.bbox, quote=l.text, conf=l.conf, source=l.source)
        for rx in det.patterns:
            if rx.search(up.text):
                return ev(up, 1, None, quote=det.label, source="vector")
        return None
    l = hint_line(up, det.hints)
    return ev(up, l.page, l.bbox, quote=l.text, conf=l.conf, source=l.source) if l else None


@register("stamp")
def stamp_check(up: Upload, det: DetailCheck) -> dict | None:
    ok, box, page = detectors.has_stamp(up)
    return ev(up, page, box, quote="circular seal") if ok else None


@register("signature_and_date")
def signature_and_date_check(up: Upload, det: DetailCheck) -> dict | None:
    signed, box, page = detectors.signature_ink(up)
    return ev(up, page, box, quote="signed and dated") if signed and detectors.dated(up) else None


@register("every_elevation_has_height")
def every_elevation_has_height(up: Upload, det: DetailCheck) -> dict | None:
    heads = [l for l in up.lines if re.search(r"\b(north|south|east|west) elevation", l.text, re.I)]
    hts = [l for l in up.lines if re.search(r"height\s*\d", l.text, re.I)]
    return ev(up, heads[0].page, heads[0].bbox, quote=f"{len(hts)} heights") if heads and len(hts) >= len(heads) else None


@register("form_field")
def form_field_check(up: Upload, det: DetailCheck) -> dict | None:
    """Placeholder: application-form fields are checked from the application data by the engine today.
    Future: read `det.form_field` from the fillable PDF (up.doc widgets) or OCR the printed label
    using data/vision/forms/*.json."""
    return None


@register("none")
def no_check(up: Upload, det: DetailCheck) -> dict | None:
    return None


def run(up: Upload, det: DetailCheck) -> dict | None:
    return CHECKS.get(det.check, text_check)(up, det)
