import json
import pathlib

import pytest
from fastapi.testclient import TestClient

from permit_review.main import app

FILES = pathlib.Path(__file__).resolve().parents[3] / "fixtures" / "files"
PDF = b"%PDF-1.7\n%synthetic\n"


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def post(client, files, hints=None):
    r = client.post("/review", files=[("files", (n, b, "application/octet-stream")) for n, b in files],
                    data={"submission": json.dumps({"document_hints": hints or {}})})
    assert r.status_code == 200, r.text
    return r.json()


def codes(out):
    return [f["fileCode"] for f in out["findings"]]


def test_health(client):
    assert client.get("/health").json() == {"ok": True}


def test_clean_pdf_has_no_findings_and_keeps_the_page_type(client):
    out = post(client, [("Deck_Plan.pdf", PDF)], {"Deck_Plan.pdf": "deck_plan"})
    assert out["findings"] == []
    assert out["documents"] == [{"filename": "Deck_Plan.pdf", "document_type": "deck_plan", "shown_details": [], "detail_evidence": {}}]


@pytest.mark.parametrize("case,code", [
    ("FILE-001/FloorPlan.docx", "WRONG_FORMAT"),
    ("FILE-003/scan0004.pdf", "UNCLEAR_NAME"),
    ("FILE-008/RoofPlan.pdf", "UNREADABLE"),
])
def test_infopkg_file_cases(client, case, code):
    p = FILES / case
    out = post(client, [(p.name, p.read_bytes())])
    assert codes(out) == [code]
    assert out["findings"][0]["message"] in {
        "Upload the plan as a PDF.", "Rename the file so its content can be identified.", "Replace the file with a readable copy."}


def test_duplicate_versions(client):
    a, b = FILES / "FILE-004/SitePlan.pdf", FILES / "FILE-004/SitePlan (1).pdf"
    out = post(client, [(a.name, a.read_bytes()), (b.name, b.read_bytes())])
    assert codes(out) == ["DUPLICATE"]
    assert out["findings"][0]["message"] == "Confirm which version should be included."


def test_too_many_files(client):
    r = client.post("/review", files=[("files", (f"f{i}.pdf", PDF, "application/pdf")) for i in range(31)],
                    data={"submission": "{}"})
    assert r.status_code == 413
