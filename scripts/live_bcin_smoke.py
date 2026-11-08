"""Opt-in live BCIN alternative-field regression checks. Requires `pnpm dev`.

Uses synthetic PDFs through the production review service, spending Gateway
credits. No credentials are read here and no registry/authenticity check is made.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import httpx2
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "work" / "bcin-smoke"
BCIN = "hvac.designer_declaration.individual_bcin"
# Same plausible synthetic number in every filled box: the selected location,
# not a different field's value, must determine the presence decision.
CASES = [
    ("registered-firm", 0, "123456", "", True),
    ("other-designer", 1, "", "123456", True),
    ("wrong-branch", 0, "", "123456", False),
    ("missing", 0, "", "", False),
    ("placeholder", 0, "TEST-BCIN-0000", "", False),
    ("no-choice", None, "123456", "", False),
]


def control(selected: int | None, first: str, second: str) -> bytes:
    with pymupdf.open() as doc:
        p = doc.new_page(width=612, height=792)
        p.insert_text(
            (40, 45), "SYNTHETIC SCHEDULE 1: DESIGNER INFORMATION", fontsize=14
        )
        p.insert_text((40, 80), "D. Declaration of designer", fontsize=13)
        p.insert_text(
            (40, 110),
            "I, Example Designer, declare that (choose one as appropriate):",
            fontsize=10,
        )
        for i, (y, description) in enumerate(
            [
                (
                    150,
                    "I review and take responsibility for the design on behalf of a registered firm.",
                ),
                (
                    290,
                    "I review and take responsibility for the design as an 'other designer'.",
                ),
                (
                    430,
                    "The design work is exempt from registration and qualification requirements.",
                ),
            ]
        ):
            p.draw_rect(pymupdf.Rect(40, y, 54, y + 14))
            if i == selected:
                p.draw_line((42, y + 2), (52, y + 12))
                p.draw_line((52, y + 2), (42, y + 12))
            p.insert_textbox(pymupdf.Rect(65, y, 570, y + 40), description, fontsize=10)
            if i < 2:
                p.draw_rect(pymupdf.Rect(40, y + 45, 300, y + 100))
                p.insert_text((45, y + 60), "Individual BCIN:", fontsize=10)
                p.insert_text((45, y + 85), first if i == 0 else second, fontsize=12)
            if i == 0:
                p.draw_rect(pymupdf.Rect(300, y + 45, 570, y + 100))
                p.insert_text((305, y + 60), "Firm BCIN:", fontsize=10)
                p.insert_text((305, y + 85), "654321", fontsize=12)
        return doc.tobytes(deflate=True)


def scanned(data: bytes) -> bytes:
    with pymupdf.open(stream=data, filetype="pdf") as source, pymupdf.open() as doc:
        for page in source:
            png = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False).tobytes(
                "png"
            )
            doc.new_page(width=612, height=792).insert_image(page.rect, stream=png)
        return doc.tobytes(deflate=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--review-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    with httpx2.Client(timeout=180, trust_env=False) as client:
        for case, selected, first, second, expected in CASES:
            data = control(selected, first, second)
            for kind in ("typed", "scanned"):
                filename = f"{case}-{kind}.pdf"
                pdf = data if kind == "typed" else scanned(data)
                (OUT / filename).write_bytes(pdf)
                sub = {
                    "application": {"project_type": "hvac_system"},
                    "project_attributes": {
                        "owner_differs_from_applicant": False,
                        "builder_known": False,
                    },
                    "document_hints": {filename: "application_form"},
                }
                response = client.post(
                    args.review_url.rstrip("/") + "/review",
                    files={
                        "files": (filename, pdf, "application/pdf"),
                    },
                    data={"submission": json.dumps(sub)},
                )
                response.raise_for_status()
                body = response.json()
                shown = body["documents"][0]["shown_details"]
                unavailable = any(
                    f["id"].startswith("review:unavailable:") for f in body["findings"]
                )
                result = {
                    "case": filename,
                    "expected": expected,
                    "found": BCIN in shown,
                    "unavailable": unavailable,
                    "passed": not unavailable and (BCIN in shown) == expected,
                }
                assert shown.count(BCIN) <= 1
                assert (
                    body["documents"][0]["detail_evidence"] == {}
                    and body["inferred_attributes"] == {}
                )
                (OUT / (filename + ".json")).write_text(json.dumps(body, indent=2))
                results.append(result)
                (OUT / "results.json").write_text(json.dumps(results, indent=2))
                print(json.dumps(result), flush=True)
    assert all(r["passed"] for r in results), "Inspect work/bcin-smoke/results.json"


if __name__ == "__main__":
    main()
