"""File checks that need only the file name and bytes (no document reading).

Checks of what a document shows will come from the custom review API (see review.py).
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

# InfoPkg §8 wording, same as FILE_FINDING_MESSAGES in packages/schema.
MESSAGES = {
    "WRONG_FORMAT": "Upload the plan as a PDF.",
    "DUPLICATE": "Confirm which version should be included.",
    "UNREADABLE": "Replace the file with a readable copy.",
    "PASSWORD_PROTECTED": "Upload an unsecured version of the PDF.",
    "SIGNATURE_MISSING": "Add the applicable signature before submission.",
    "ADDRESS_MISMATCH": "Confirm the correct project address.",
    "COMBINED_TYPES": "Separate or label the documents so they can be identified.",
}
CATEGORY = {"WRONG_FORMAT": "wrong", "UNREADABLE": "wrong", "DUPLICATE": "unclear",
            "PASSWORD_PROTECTED": "wrong", "SIGNATURE_MISSING": "incomplete",
            "ADDRESS_MISMATCH": "inconsistent", "COMBINED_TYPES": "wrong"}


@dataclass
class Upload:
    filename: str
    data: bytes

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.data).hexdigest()


def is_pdf(data: bytes) -> bool:
    return b"%PDF-" in data[:1024]


def stem(filename: str) -> str:
    return re.sub(r"\.[a-z0-9]+$", "", filename, flags=re.I).strip()


def normalised_name(filename: str) -> str:
    s = re.sub(r"\s*\(\d+\)$|[\s_\-]*(copy|final|v\d+)$", "", stem(filename).lower())
    return re.sub(r"[^a-z0-9]", "", s)


def finding(code: str, filename: str, quote: str | None = None) -> dict:
    category = CATEGORY[code]
    return {
        "id": f"file:{code}:{filename}",
        "category": category,
        "severity": "blocker" if category == "wrong" else "warning",
        "fileCode": code,
        "message": MESSAGES[code],
        "evidence": [{"filename": filename, "page": 1, "expectedRegion": False, "confidence": 1,
                      "source": "rule", "quote": quote or filename}],
    }


def file_findings(uploads: list[Upload]) -> list[dict]:
    out: list[dict] = []
    seen: dict[str, str] = {}
    for up in uploads:
        if not is_pdf(up.data):
            # A .pdf that isn't one is unreadable; anything else is the wrong format.
            out.append(finding("UNREADABLE" if up.filename.lower().endswith(".pdf") else "WRONG_FORMAT", up.filename))
        keys = (up.sha256, "n:" + normalised_name(up.filename))
        prev = next((seen[k] for k in keys if k in seen), None)
        if prev:
            out.append(finding("DUPLICATE", up.filename, f"Same as {prev}"))
        for k in keys:
            seen.setdefault(k, up.filename)
    return out
