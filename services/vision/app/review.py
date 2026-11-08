"""Turns uploads into documents (type + shown details + evidence) and findings."""
from __future__ import annotations

import base64
import re
from typing import Any

import pymupdf as fitz

from . import checks, detectors, vlm
from .checks import ev, find_line, hint_line
from .config import DETAILS, FALLBACK_URL, FILENAME_RULES, RESOURCES, TITLE_RULES, details_for
from .ingest import Upload, normalised_name, vague_name

MESSAGES = {
    "WRONG_FORMAT": "Upload the plan as a PDF.",
    "PASSWORD_PROTECTED": "Upload an unsecured version of the PDF.",
    "UNCLEAR_NAME": "Rename the file so its content can be identified.",
    "DUPLICATE": "Confirm which version should be included.",
    "SIGNATURE_MISSING": "Add the applicable signature before submission.",
    "ADDRESS_MISMATCH": "Confirm the correct project address.",
    "COMBINED_TYPES": "Separate or label the documents so they can be identified.",
    "UNREADABLE": "Replace the file with a readable copy.",
}
CATEGORY = {
    "WRONG_FORMAT": "wrong", "PASSWORD_PROTECTED": "wrong", "UNREADABLE": "wrong", "UNCLEAR_NAME": "unclear",
    "DUPLICATE": "unclear", "SIGNATURE_MISSING": "incomplete", "ADDRESS_MISMATCH": "inconsistent", "COMBINED_TYPES": "unclear",
}
INFOPKG_FILE_SECTION = "§8"


# ───────────────────────── document classification (rules in data/vision/document-types.json) ─────────────────────────


def _match(rules, text: str) -> str | None:
    for rx, t in rules:
        if rx.search(text):
            return t
    return None


def page_title(up: Upload, page: int) -> str:
    """Prefer the title block 'DRAWING:' line, else the largest text near the top."""
    for l in up.lines:
        if l.page == page and l.text.upper().startswith("DRAWING:"):
            return l.text.split(":", 1)[1].strip()
    top = [l for l in up.lines if l.page == page and l.bbox[1] < 80]
    return top[0].text if top else ""


def classify(up: Upload) -> tuple[str, list[str]]:
    """(document type, distinct per-page types)."""
    per_page = []
    for p in range(1, (up.doc.page_count if up.doc else 0) + 1):
        t = _match(TITLE_RULES, page_title(up, p))
        if t:
            per_page.append(t)
    stem = re.sub(r"\.[a-z0-9]+$", "", up.filename).replace(" ", "_")
    by_name = _match(FILENAME_RULES, stem)
    distinct = list(dict.fromkeys(per_page))
    return (by_name or (distinct[0] if distinct else "other")), distinct


def check_detail(up: Upload, det: dict, ptype: str) -> dict | None:
    """Evidence dict when the detail is shown on this upload, else None (dispatches on the detail's `vision.check`)."""
    return checks.run(up, DETAILS[det["id"]])


ADDRESS_RX = re.compile(r"(?:property\s+)?address\s*:\s*(.+)", re.I)


def norm_addr(a: str) -> str:
    a = a.lower()
    for k, v in {"street": "st", "avenue": "ave", "crescent": "cres", "drive": "dr", "road": "rd", "court": "crt", "lane": "ln"}.items():
        a = re.sub(rf"\b{k}\b", v, a)
    return re.sub(r"[^a-z0-9]", "", a.split(",")[0])


NUM = r"(\d+(?:[.,]\d+)?)"


def preview(up: Upload) -> list[dict]:
    out = []
    if not up.doc:
        return out
    for i, p in enumerate(up.doc, start=1):
        if i > 4:
            break
        pix = p.get_pixmap(dpi=72)
        out.append({"page": i, "width": p.rect.width, "height": p.rect.height,
                    "png_base64": base64.b64encode(pix.tobytes("png")).decode()})
    return out


def finding(code: str, up_name: str, evidence: list[dict], *, conflicts=None, detail=None, howto=None) -> dict:
    f = {
        "id": f"file:{code}:{up_name}",
        "category": CATEGORY[code],
        "severity": "blocker" if CATEGORY[code] in ("wrong", "inconsistent") else "warning",
        "fileCode": code,
        "message": MESSAGES[code],
        "evidence": evidence,
        "reference": {"requirementLabel": "Electronic plans and documents", "infoPkgSection": INFOPKG_FILE_SECTION,
                      "cityUrl": FALLBACK_URL, "howToFix": howto or MESSAGES[code]},
    }
    if conflicts:
        f["conflictsWith"] = conflicts
    if detail:
        f["detailId"] = detail
    return f


def review(uploads: list[Upload], submission: dict) -> dict:
    app = submission.get("application", {})
    attrs = submission.get("project_attributes", {})
    ptype = app.get("project_type", "")
    documents, findings = [], []
    inferred: dict[str, Any] = {}
    form_fields: dict[str, Any] = {}
    use_vlm = vlm.enabled()
    hints: dict[str, str] = submission.get("document_hints", {}) or {}

    # Duplicates (same bytes or same normalised name).
    seen: dict[str, Upload] = {}
    for up in uploads:
        for key in (up.sha256, "n:" + normalised_name(up.filename)):
            if key in seen and seen[key] is not up:
                findings.append(finding("DUPLICATE", up.filename, [ev(up, 1, quote=f"Same as {seen[key].filename}")]))
                break
        seen.setdefault(up.sha256, up)
        seen.setdefault("n:" + normalised_name(up.filename), up)

    for up in uploads:
        if up.problem:
            findings.append(finding(up.problem, up.filename, [ev(up, 1, quote=up.filename)]))
            documents.append({"filename": up.filename, "document_type": "other", "pages": 0, "shown_details": [], "confidence": 0.0})
            continue
        if vague_name(up.filename):
            findings.append(finding("UNCLEAR_NAME", up.filename, [ev(up, 1, quote=up.filename)]))
        dtype, page_types = classify(up)
        # The applicant uploaded this file to a specific requirement slot: trust that over the guess.
        dtype = hints.get(up.filename) or dtype
        if len(set(page_types)) >= 2:
            findings.append(finding("COMBINED_TYPES", up.filename, [ev(up, i + 1, quote=t) for i, t in enumerate(page_types)]))

        shown, evidence = [], {}
        missing_for_vlm = []
        for req, det in details_for(ptype, dtype):
            e = check_detail(up, det, ptype)
            if e:
                shown.append(det["id"]); evidence[det["id"]] = e
            else:
                missing_for_vlm.append((req, det))
        # For details not shown, point at a related label (e.g. "BEAM" with no size) so the UI can say "add it here".
        for _, det in missing_for_vlm:
            l = hint_line(up, [h for h in DETAILS[det["id"]].hints if len(h) > 3] + [det["label"].split()[0]])
            if l:
                evidence["near:" + det["id"]] = ev(up, l.page, l.bbox, quote=l.text, conf=l.conf, source=l.source, expected=True)
        if use_vlm and missing_for_vlm:
            for did, e in vlm.confirm(up, [d for _, d in missing_for_vlm]).items():
                shown.append(did); evidence[did] = e

        # Address in the title block vs the application.
        want = app.get("property_address", "")
        for l in up.lines:
            m = ADDRESS_RX.search(l.text)
            if m and want and norm_addr(m.group(1)) != norm_addr(want):
                findings.append(finding("ADDRESS_MISMATCH", up.filename, [ev(up, l.page, l.bbox, quote=l.text, value=m.group(1).strip())],
                                        conflicts=[{"filename": "Application", "page": 1, "confidence": 1, "source": "form_field", "expectedRegion": False, "value": want}],
                                        howto=f"This drawing says “{m.group(1).strip()}” but the application says “{want}”. Confirm the correct project address."))
                break

        # Signature box present on a professional drawing but empty, where no requirement detail already covers it.
        covered = any(d["id"].endswith(".signature_date") for _, d in details_for(ptype, dtype))
        if dtype != "application_form" and not covered:
            signed, box, page = detectors.signature_ink(up)
            if signed is False:
                findings.append(finding("SIGNATURE_MISSING", up.filename, [ev(up, page, box, expected=True, quote="Empty signature box")]))

        if dtype == "application_form":
            signed, box, page = detectors.signature_ink(up, r"applicant signature")
            if signed is not None:
                form_fields["signature_present"] = signed
            if re.search(r"declaration\s*:\s*\[x\]", up.text, re.I):
                form_fields["declaration_completed"] = True
            elif re.search(r"declaration\s*:\s*\[\s*\]", up.text, re.I):
                form_fields["declaration_completed"] = False

        # Facts the engine needs, read from the drawings.
        if re.search(r"remov\w*\s+(the\s+)?existing\s+(exterior\s+)?wall", up.text, re.I) and dtype != "project_description":
            inferred["removes_existing_exterior_wall"] = True
        if dtype == "deck_side_view":
            m = re.search(rf"deck (?:ht|height)\.?\D{{0,6}}{NUM}\s*m\b", up.text, re.I)
            if m and "deck_height_metres" in attrs:
                drawn = float(m.group(1).replace(",", "."))
                if abs(drawn - float(attrs["deck_height_metres"])) > 0.05:
                    l = find_line(up, re.compile(r"deck (ht|height)", re.I))
                    findings.append({
                        "id": f"cons:deck_height:{up.filename}", "category": "inconsistent", "severity": "blocker",
                        "detailId": "deck.side_view.deck_height",
                        "message": f"The deck height does not match. The application says {attrs['deck_height_metres']} m but the side view shows {drawn} m.",
                        "evidence": [ev(up, l.page if l else 1, l.bbox if l else None, quote=l.text if l else None, value=drawn)],
                        "conflictsWith": [{"filename": "Application", "page": 1, "confidence": 1, "source": "form_field", "expectedRegion": False, "value": attrs["deck_height_metres"]}],
                        "reference": {"requirementLabel": "Deck side view", "infoPkgSection": "§5.3", "cityUrl": RESOURCES.get("residential-permits", {}).get("url", FALLBACK_URL),
                                      "howToFix": "Correct whichever value is wrong so the application and drawings agree."},
                    })


        conf = 1.0 if up.lines else 0.0  # 0 = no text in the PDF (scanned/image-only; there is no OCR)
        documents.append({"filename": up.filename, "document_type": dtype, "pages": up.doc.page_count if up.doc else 0,
                          "shown_details": shown, "confidence": round(conf, 3), "detail_evidence": evidence, "previews": preview(up)})

    return {"documents": documents, "findings": findings, "timings": {}, "vlm_used": use_vlm,
            "inferred_attributes": inferred, "form_fields": form_fields}
