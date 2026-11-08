"""Builds review responses (contract: ReviewResponse in packages/schema).

Integration point for the custom review API: it will report, per document, which details it shows
(`shown_details`) and where (`detail_evidence`). Until then documents come back with no details,
and the web app runs in placeholder mode (PLACEHOLDER_TICKS in apps/web/lib/review.ts).
"""
from __future__ import annotations

import json

from .checks import Upload, file_findings, finding, normalised_name
from .storage import ROOT, Stored

# Pages that may hold the same file (data/document-types.json `mayShareFileWith`): Schedule 1 is part of the
# same Ontario application form PDF, so one file on both pages is not a duplicate.
_TYPES = json.loads((ROOT / "data" / "document-types.json").read_text(encoding="utf-8"))["documentTypes"]
MAY_SHARE = {frozenset((t["type"], o)) for t in _TYPES for o in t.get("mayShareFileWith", [])}


def review(uploads: list[Upload], submission: dict) -> dict:
    hints: dict[str, str] = submission.get("document_hints") or {}
    documents = [{"filename": up.filename, "document_type": hints.get(up.filename, "other"),
                  "shown_details": [], "detail_evidence": {}} for up in uploads]
    return {"documents": documents, "findings": file_findings(uploads), "inferred_attributes": {}}


def review_session(files: list[Stored]) -> list[dict]:
    """Every saved file with its review. A file that repeats one saved earlier on another page
    (same bytes, or the same name apart from "(1)", "copy", "v2"…) gets the InfoPkg duplicate message;
    the evidence `value` is the other page, so the app can name it. Pages in MAY_SHARE are exempt."""
    out = []
    for i, s in enumerate(files):  # files are in upload order
        sub = {**s.submission, "document_hints": {s.name: s.page}}
        res = review([Upload(s.name, s.read())], sub)
        for earlier in files[:i]:
            if frozenset((earlier.page, s.page)) in MAY_SHARE:
                continue
            if earlier.sha256 == s.sha256 or normalised_name(earlier.name) == normalised_name(s.name):
                f = finding("DUPLICATE", s.name, f"Same file as {earlier.name}")
                f["id"] = f"file:DUPLICATE:{s.page}"
                f["evidence"][0]["value"] = earlier.page
                res["findings"].append(f)
                break
        out.append({"page": s.page, "file": s.meta(), "review": res})
    return out
