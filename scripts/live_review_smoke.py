"""Opt-in synthetic checks against the RUNNING production review and AI services.

Run `pnpm dev`, then `uv run python scripts/live_review_smoke.py` from the root.
This spends Gateway credits. No credentials are read by this script. Artifacts
and boolean-only responses go in ignored work/live-validation/.
Use --expect-unavailable with an intentionally unavailable AI service to verify
that a fresh upload returns a warning, no ticks and no cached success.
"""

from __future__ import annotations

import argparse
import base64
import json
import time
from pathlib import Path

import httpx2
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "work" / "live-validation"
SCENARIO = json.loads((ROOT / "data/scenarios/MOCK-CONTROL-001.json").read_text())
GENERAL = json.loads((ROOT / "data/requirements/general.json").read_text())
SUBMISSION = {k: SCENARIO[k] for k in ("application", "project_attributes")}
DETAILS = [
    d for r in GENERAL["requirements"] if not r.get("appliesWhen") for d in r["details"]
]
REQUIRED = {d["id"] for d in DETAILS if not d.get("optional")}
VALUES = {
    "applicant_name": "Jamie Wilson",
    "property_address": "987 Test Case Court, Kitchener",
    "applicant_role": "[X] Owner  [ ] Authorized agent of owner",
    "project_type": "[X] New construction: deck",
    "project_description": "Construct a rear-yard deck",
    "estimated_construction_value": "$16,000",
    "submission_date": "2026-10-16",
    "declaration_completed": "I, Jamie Wilson, declare the information is true.",
    "signature_present": "MARK",
    "submitted_to": "City of Kitchener",
    "municipality": "Kitchener",
    "postal_code": "N2G 1A1",
    "area_of_work": "24 m2",
    "proposed_use": "Residential dwelling with deck",
    "current_use": "Residential dwelling",
    "street_address": "987 Test Case Court",
    "province": "Ontario",
    "email": "jamie.wilson@example.test",
    "telephone": "519-555-0142",
    "new_home": "[ ] Yes [X] No",
    "meets_requirements": "[X] Yes [ ] No",
    "fees_paid": "[X] Yes [ ] No",
    "plans_and_specifications": "[X] Yes [ ] No",
    "information_and_documents": "[X] Yes [ ] No",
    "applicable_law": "[X] Yes [ ] No",
}
VARIANTS = {
    "control": {},
    "missing-fields": {
        "general.application.property_address": "",
        "general.applicant.email": "",
        "general.applicant.telephone": "",
    },
    "missing-signature": {"general.application.signature_present": ""},
    "implausible": {
        "general.applicant.telephone": "banana",
        "general.applicant.email": "not-an-email",
        "general.site.postal_code": "!!!!",
        "general.application.submission_date": "2026-99-99",
        "general.application.estimated_construction_value": "minus one million dollars",
    },
    "placeholder": {
        "general.applicant.telephone": "TBD",
        "general.applicant.email": "________",
    },
    "invalid-formats": {
        "general.applicant.telephone": "12",
        "general.applicant.email": "jamie@",
        "general.site.postal_code": "123",
        "general.application.submission_date": "2026-02-30",
        "general.application.estimated_construction_value": "-100",
    },
    "labels-only": {d["id"]: "" for d in DETAILS},
}


def form(overrides: dict[str, str]) -> bytes:
    """Synthetic values are drawn into labelled fields; no text is read from PDFs."""
    with pymupdf.open() as doc:
        page, y, section = None, 0, None
        for detail in DETAILS:
            next_section = detail.get("section", "")
            if page is None or y > 680:
                page = doc.new_page(width=612, height=792)
                page.insert_text(
                    (35, 30),
                    "SYNTHETIC PERMIT APPLICATION - TEST DATA ONLY",
                    fontsize=12,
                )
                y, section = 60, None
            if next_section != section:
                page.insert_text((35, y), next_section, fontsize=11)
                section, y = next_section, y + 24
            label = (
                detail["label"]
                .replace("\u201c", '"')
                .replace("\u201d", '"')
                .replace("m²", "m2")
            )
            page.insert_text((40, y), label[:88], fontsize=10)
            y += 16
            default = (
                ""
                if detail.get("optional")
                else VALUES[detail["id"].rsplit(".", 1)[-1]]
            )
            value = overrides.get(detail["id"], default)
            if value == "MARK":
                points = [
                    (45, y),
                    (57, y - 6),
                    (67, y + 2),
                    (79, y - 9),
                    (88, y - 2),
                    (103, y - 5),
                    (114, y + 2),
                    (135, y - 7),
                ]
                for a, b in zip(points, points[1:]):
                    page.draw_line(a, b, color=(0, 0, 0.4), width=1.4)
            else:
                page.insert_text((45, y), value, fontsize=11)
            y += 27
        return doc.tobytes(deflate=True)


def scanned(data: bytes) -> bytes:
    with pymupdf.open(stream=data, filetype="pdf") as original, pymupdf.open() as scan:
        for page in original:
            image = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False).tobytes(
                "png"
            )
            scan.new_page(width=page.rect.width, height=page.rect.height).insert_image(
                page.rect, stream=image
            )
        return scan.tobytes(deflate=True)


def drawing_controls() -> dict[str, bytes]:
    """Actual labelled geometry, rather than a list of features beside generic lines."""
    out = {}
    for name in ("Site_Plan.pdf", "Deck_Plan.pdf", "Deck_Side_View.pdf"):
        with pymupdf.open() as doc:
            p = doc.new_page(width=612, height=792)

            def text(x, y, value, size=10):
                p.insert_text((x, y), value, fontsize=size)

            def rect(box, label, x, y):
                p.draw_rect(pymupdf.Rect(*box), width=1.5)
                text(x, y, label)

            text(
                35,
                35,
                "SYNTHETIC " + name.replace("_", " ").replace(".pdf", "").upper(),
                15,
            )
            text(35, 55, "987 Test Case Court, Kitchener - test data only")
            text(35, 75, "Schematic drawing; dimensions are written, not to scale.")
            if name == "Site_Plan.pdf":
                rect((70, 120, 490, 700), "LOT / PROPERTY BOUNDARY", 90, 140)
                rect((180, 210, 380, 360), "EXISTING HOUSE", 225, 280)
                rect((200, 360, 360, 480), "PROPOSED DECK", 215, 410)
                text(218, 430, "5.5 m x 3.6 m")
                text(180, 330, "Deck attached to rear of house")
                rect((95, 525, 165, 590), "SHED", 115, 560)
                rect((390, 530, 460, 610), "POOL", 410, 575)
                p.draw_line((280, 480), (280, 700))
                text(285, 640, "Rear property line: 7.5 m")
                p.draw_line((360, 460), (490, 460))
                text(370, 450, "Side line: 1.8 m")
                text(100, 730, "Front street / Test Case Court")
            elif name == "Deck_Plan.pdf":
                rect((100, 150, 480, 430), "DECK FRAMING - TOP VIEW", 180, 135)
                for x in range(125, 470, 25):
                    p.draw_line((x, 150), (x, 430), width=0.6)
                text(135, 220, "JOISTS: 2x8 @ 16 in o.c.")
                for y in (175, 405):
                    p.draw_line((100, y), (480, y), width=5)
                    for x in (115, 290, 465):
                        p.draw_rect(
                            pymupdf.Rect(x - 7, y - 7, x + 7, y + 7),
                            fill=(0.3, 0.3, 0.3),
                        )
                text(135, 315, "BEAMS: 3-2x10 built-up")
                text(135, 340, "All six square supports: 6x6 POSTS")
                rect((240, 430, 340, 490), "LANDING", 265, 465)
                rect((255, 490, 325, 620), "STAIRS", 345, 560)
                for y in range(505, 620, 15):
                    p.draw_line((255, y), (325, y))
                p.draw_line((345, 555), (325, 555))
                text(120, 670, "Stairs descend from deck via the landing to the yard.")
            else:
                p.draw_line((70, 600), (530, 600), width=2)
                text(75, 625, "GROUND")
                p.draw_line((110, 450), (470, 450), width=4)
                text(300, 475, "DECK FLOOR")
                for x in (130, 440):
                    p.draw_line((x, 450), (x, 600), width=5)
                p.draw_line((110, 250), (470, 250), width=3)
                for x in range(110, 480, 30):
                    p.draw_line((x, 250), (x, 450))
                text(280, 235, "GUARD / RAILING")
                p.draw_line((85, 450), (85, 600))
                text(40, 530, "Deck height: 0.75 m")
                p.draw_line((500, 250), (500, 450))
                text(355, 365, "Guard height: 1.07 m")
            out[name] = doc.tobytes(deflate=True)
    return out


def run_review(client, name, data, document_type, expected_true, expected_false=()):
    sub = {**SUBMISSION, "document_hints": {name: document_type}}
    started = time.monotonic()
    response = client.post(
        "http://127.0.0.1:8000/review",
        files={"files": (name, data, "application/pdf")},
        data={"submission": json.dumps(sub)},
    )
    response.raise_for_status()
    body = response.json()
    shown = set(body["documents"][0]["shown_details"])
    result = {
        "case": name,
        "seconds": round(time.monotonic() - started, 2),
        "expected_true_missing": sorted(set(expected_true) - shown),
        "expected_false_positive": sorted(set(expected_false) & shown),
        "finding_codes": [f.get("fileCode", f["id"]) for f in body["findings"]],
    }
    result["passed"] = (
        not result["expected_true_missing"] and not result["expected_false_positive"]
    )
    result["passed"] &= not any(
        f["id"].startswith("review:unavailable:") for f in body["findings"]
    )
    # A missing signature must have its fixed finding; positive controls must have no findings.
    if "general.application.signature_present" in expected_false:
        result["passed"] &= "SIGNATURE_MISSING" in result["finding_codes"]
    if name.startswith(("control-", "typed-", "scanned-")):
        result["passed"] &= not body["findings"]
    assert (
        body["documents"][0]["detail_evidence"] == {}
        and body["inferred_attributes"] == {}
    )
    (OUT / (name + ".json")).write_text(json.dumps(body, indent=2))
    print(json.dumps(result), flush=True)
    return result


def unavailable(client):
    """Call twice: failures must be retried, and never cached as positive decisions."""
    sid = "e" * 32
    name = "Unavailable-Control.pdf"
    url = f"http://127.0.0.1:8000/sessions/{sid}/files/application_form"
    sub = {**SUBMISSION, "document_hints": {name: "application_form"}}
    try:
        response = client.put(
            url,
            files={"file": (name, form({}), "application/pdf")},
            data={"submission": json.dumps(sub)},
        )
        response.raise_for_status()
        results = [response.json()]
        response = client.get(f"http://127.0.0.1:8000/sessions/{sid}/files")
        response.raise_for_status()
        results.append(response.json())
        for result in results:
            review = result["files"][0]["review"]
            assert review["documents"][0]["shown_details"] == []
            assert any(
                f["id"].startswith("review:unavailable:") for f in review["findings"]
            )
        assert not list((ROOT / ".uploads" / sid).glob("*.review-cache"))
        print(
            "Unavailable API: warning, zero ticks on save/reload, no cached success.",
            flush=True,
        )
    finally:
        client.delete(f"http://127.0.0.1:8000/sessions/{sid}").raise_for_status()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expect-unavailable", action="store_true")
    parser.add_argument("--write-control-fixtures", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.write_control_fixtures:
        target = ROOT / "apps/web/public/demo/MOCK-CONTROL-001"
        for name, data in {
            "Application_Form.pdf": form({}),
            **drawing_controls(),
        }.items():
            (target / name).write_bytes(data)
        print("Regenerated the four synthetic control PDFs; no network requests.")
        return
    with httpx2.Client(timeout=180, trust_env=False) as client:
        client.get("http://127.0.0.1:8000/health").raise_for_status()
        client.get("http://127.0.0.1:8101/health").raise_for_status()
        if args.expect_unavailable:
            unavailable(client)
            return
        results = []
        for name, overrides in VARIANTS.items():
            data = form(overrides)
            for kind in ("typed", "scanned"):
                pdf = data if kind == "typed" else scanned(data)
                filename = f"{name}-{kind}.pdf"
                (OUT / filename).write_bytes(pdf)
                results.append(
                    run_review(
                        client,
                        filename,
                        pdf,
                        "application_form",
                        REQUIRED - set(overrides),
                        set(overrides),
                    )
                )
        for document in SCENARIO["documents"][1:]:
            data = (
                ROOT / "apps/web/public/demo/MOCK-CONTROL-001" / document["filename"]
            ).read_bytes()
            for kind in ("typed", "scanned"):
                pdf = data if kind == "typed" else scanned(data)
                results.append(
                    run_review(
                        client,
                        kind + "-" + document["filename"],
                        pdf,
                        document["document_type"],
                        document["shown_details"],
                    )
                )
        # Cross the four-image boundary: all dimensional evidence is on page five.
        with (
            pymupdf.open() as doc,
            pymupdf.open(
                ROOT / "apps/web/public/demo/MOCK-CONTROL-001/Deck_Side_View.pdf"
            ) as drawing,
        ):
            for i in range(4):
                doc.new_page().insert_text(
                    (50, 50),
                    f"Synthetic cover page {i + 1}; dimensions are on the last page.",
                )
            doc.insert_pdf(drawing)
            data = doc.tobytes()
        for kind in ("typed", "scanned"):
            results.append(
                run_review(
                    client,
                    f"later-page-{kind}.pdf",
                    data if kind == "typed" else scanned(data),
                    "deck_side_view",
                    {"deck.side_view.deck_height", "deck.side_view.guard_height"},
                )
            )
        # Preserve the PDF-case results even if the separate raw-contract probe fails.
        (OUT / "matrix-results.json").write_text(json.dumps(results, indent=2))
        with pymupdf.open(stream=form({}), filetype="pdf") as doc:
            images = [
                base64.b64encode(
                    p.get_pixmap(matrix=pymupdf.Matrix(2, 2)).tobytes("png")
                ).decode()
                for p in doc
            ]
        response = client.post(
            "http://127.0.0.1:8101/decisions",
            json={
                "images": images,
                "project_type": "deck_porch",
                "document_type": "application_form",
                "project_attributes": SUBMISSION["project_attributes"],
                "expected_address": SUBMISSION["application"]["property_address"],
            },
        )
        response.raise_for_status()
        raw = response.json()
        assert set(raw) == {d["id"] for d in DETAILS} | {
            "file.readable",
            "file.address_consistent",
            "file.labelled",
        }
        assert all(type(v) is bool for v in raw.values())
        (OUT / "raw-booleans.json").write_text(json.dumps(raw, indent=2))
        print("Raw live bridge output: exact keys, boolean values only.", flush=True)
    assert all(r["passed"] for r in results), (
        "Live matrix failures; inspect work/live-validation/matrix-results.json"
    )


if __name__ == "__main__":
    main()
