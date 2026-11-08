"""File checks and boolean visual decisions; never return extracted document values."""
from __future__ import annotations

import json
import hashlib
import threading

from .checks import Upload, file_findings, finding, is_pdf, normalised_name
from .decisions import DecisionsUnavailable, DocumentProblem, inspect_pdf
from .storage import ROOT, Stored

# The cache is invalidated on replacement, context/requirement changes and pipeline version changes.
CACHE_VERSION = "visual-images-v9-no-filename-warning"
_CACHE_LOCK = threading.Lock()


def unavailable(filename: str) -> dict:
    return {"id": f"review:unavailable:{filename}", "category": "unclear", "severity": "blocker",
            "message": "This document could not be checked. Try uploading it again when document review is available.",
            "evidence": [{"filename": filename, "page": 1, "expectedRegion": False,
                          "confidence": 0, "source": "rule"}]}


def review(uploads: list[Upload], submission: dict) -> dict:
    hints: dict[str, str] = submission.get("document_hints") or {}
    documents = []
    findings = file_findings(uploads)
    for up in uploads:
        doc_type = hints.get(up.filename, "other")
        document = {"filename": up.filename, "document_type": doc_type,
                    "shown_details": [], "detail_evidence": {}}
        documents.append(document)
        if not is_pdf(up.data):
            continue
        try:
            answers = inspect_pdf(up.data, submission, doc_type)
        except DocumentProblem as exc:
            findings.append(finding(exc.code, up.filename))
            continue
        except DecisionsUnavailable:
            findings.append(unavailable(up.filename))
            continue
        if not answers.get("file.readable", False):
            findings.append(finding("UNREADABLE", up.filename))
            continue
        for key, code in [("file.address_consistent", "ADDRESS_MISMATCH"), ("file.labelled", "COMBINED_TYPES")]:
            if answers.get(key) is False:
                findings.append(finding(code, up.filename))
        if answers.get("general.application.signature_present") is False:
            findings.append(finding("SIGNATURE_MISSING", up.filename))
        document["shown_details"] = [key for key, value in answers.items() if value and not key.startswith("file.")]
    return {"documents": documents, "findings": findings, "inferred_attributes": {}}


def cached_review(s: Stored, sub: dict) -> dict:
    digest = hashlib.sha256((CACHE_VERSION + s.sha256 + json.dumps(sub, sort_keys=True)).encode())
    digest.update((ROOT / "data" / "ai-review.json").read_bytes())
    for path in sorted((ROOT / "data" / "requirements").glob("*.json")):
        digest.update(path.read_bytes())
    key = digest.hexdigest()
    path = s.path.with_suffix(".review-cache")
    # Serialise cache misses so parallel list/save calls cannot spend credits on the same file twice.
    with _CACHE_LOCK:
        try:
            cached = json.loads(path.read_text())
            if cached["key"] == key:
                return cached["result"]
        except (OSError, ValueError, KeyError):
            pass
        result = review([Upload(s.name, s.read())], sub)
        if not any(f["id"].startswith("review:unavailable:") for f in result["findings"]):
            tmp = path.with_suffix(".review-cache.tmp")
            tmp.write_text(json.dumps({"key": key, "result": result}))
            tmp.replace(path)
        return result


def review_session(files: list[Stored]) -> list[dict]:
    """Every saved file with its review. A file that repeats one saved earlier on another page
    (same bytes, or the same name apart from "(1)", "copy", "v2"…) gets the InfoPkg duplicate message;
    the evidence `value` is the other page, so the app can name it."""
    out = []
    for i, s in enumerate(files):  # files are in upload order
        sub = {**s.submission, "document_hints": {s.name: s.page}}
        # Copy before adding session-specific duplicate findings; they are recomputed after removals.
        res = json.loads(json.dumps(cached_review(s, sub)))
        for earlier in files[:i]:
            if earlier.sha256 == s.sha256 or normalised_name(earlier.name) == normalised_name(s.name):
                f = finding("DUPLICATE", s.name, f"Same file as {earlier.name}")
                f["id"] = f"file:DUPLICATE:{s.page}"
                f["evidence"][0]["value"] = earlier.page
                res["findings"].append(f)
                break
        out.append({"page": s.page, "file": s.meta(), "review": res})
    return out
