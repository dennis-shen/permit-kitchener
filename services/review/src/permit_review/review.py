"""Builds the review response (contract: ReviewResponse in packages/schema).

Integration point for the custom review API: it will report, per document, which details it shows
(`shown_details`) and where (`detail_evidence`). Until then documents come back with no details,
and the web app runs in placeholder mode (PLACEHOLDER_TICKS in apps/web/lib/review.ts).
"""
from __future__ import annotations

from .checks import Upload, file_findings


def review(uploads: list[Upload], submission: dict) -> dict:
    hints: dict[str, str] = submission.get("document_hints") or {}
    documents = [{"filename": up.filename, "document_type": hints.get(up.filename, "other"),
                  "shown_details": [], "detail_evidence": {}} for up in uploads]
    return {"documents": documents, "findings": file_findings(uploads), "inferred_attributes": {}}
