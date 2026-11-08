import json
import os
import time

import pytest
from fastapi.testclient import TestClient

from permit_review import storage
from permit_review.main import app
from conftest import pdf_bytes

SID = "a" * 32
OTHER = "b" * 32
PDF = pdf_bytes()


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "UPLOAD_DIR", tmp_path)
    return TestClient(app)


def put(client, page, name, data=PDF, sid=SID):
    r = client.put(f"/sessions/{sid}/files/{page}", files={"file": (name, data, "application/pdf")},
                   data={"submission": json.dumps({"project_attributes": {}})})
    assert r.status_code == 200, r.text
    return r.json()["files"]


def test_saved_file_is_listed_again_later(client):
    put(client, "deck_plan", "Deck_Plan.pdf")
    files = client.get(f"/sessions/{SID}/files").json()["files"]
    assert [(f["page"], f["file"]["name"], f["file"]["size"]) for f in files] == [("deck_plan", "Deck_Plan.pdf", len(PDF))]
    assert files[0]["review"]["documents"][0]["document_type"] == "deck_plan"
    assert files[0]["review"]["findings"] == []


def test_replace_remove_and_clear(client):
    put(client, "deck_plan", "Old.pdf")
    files = put(client, "deck_plan", "Deck_Plan.pdf", PDF + b"x")
    assert [f["file"]["name"] for f in files] == ["Deck_Plan.pdf"]
    put(client, "site_plan", "Site_Plan.pdf")
    assert [f["page"] for f in client.delete(f"/sessions/{SID}/files/deck_plan").json()["files"]] == ["site_plan"]
    assert client.delete(f"/sessions/{SID}").json() == {"files": []}
    assert client.get(f"/sessions/{SID}/files").json() == {"files": []}


def test_sessions_are_separate(client):
    put(client, "deck_plan", "Deck_Plan.pdf")
    assert client.get(f"/sessions/{OTHER}/files").json() == {"files": []}


def test_same_file_on_two_pages_is_a_duplicate_naming_the_other_page(client):
    put(client, "site_plan", "Site_Plan.pdf")
    files = put(client, "deck_plan", "Deck_Plan.pdf")  # same bytes
    by = {f["page"]: f["review"]["findings"] for f in files}
    assert by["site_plan"] == []
    [dup] = by["deck_plan"]
    assert dup["message"] == "Confirm which version should be included."
    assert dup["evidence"][0]["value"] == "site_plan"
    # removing the earlier copy clears it
    files = client.delete(f"/sessions/{SID}/files/site_plan").json()["files"]
    assert files[0]["review"]["findings"] == []


def test_application_form_and_schedule_1_may_be_the_same_pdf(client):
    # The City links the same Ontario form for both; Schedule 1 is page 3 of it.
    put(client, "application_form", "mmah-application_1.pdf")
    files = put(client, "designer_schedule", "mmah-application_2.pdf")
    assert all(f["review"]["findings"] == [] for f in files)
    files = put(client, "heat_loss_gain", "Heat_Loss.pdf")  # same bytes on any other page still counts
    heat = next(f for f in files if f["page"] == "heat_loss_gain")
    assert [x["fileCode"] for x in heat["review"]["findings"]] == ["DUPLICATE"]


def test_different_files_are_not_duplicates(client):
    put(client, "site_plan", "Site_Plan.pdf", PDF + b"1")
    files = put(client, "deck_plan", "Deck_Plan.pdf", PDF + b"2")
    assert all(f["review"]["findings"] == [] for f in files)


@pytest.mark.parametrize("sid,page", [("../etc", "deck_plan"), (SID, "..%2Fx"), ("A" * 32, "deck_plan"), (SID, "Deck-Plan")])
def test_rejects_unsafe_keys(client, sid, page):
    r = client.put(f"/sessions/{sid}/files/{page}", files={"file": ("a.pdf", PDF, "application/pdf")})
    assert r.status_code in (400, 404)


def test_sweep_removes_old_sessions(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "UPLOAD_DIR", tmp_path)
    storage.save(SID, "deck_plan", "a.pdf", "application/pdf", PDF, {})
    storage.save(OTHER, "deck_plan", "a.pdf", "application/pdf", PDF, {})
    old = time.time() - 30 * 86400
    os.utime(tmp_path / SID, (old, old))
    storage.sweep()
    assert not (tmp_path / SID).exists() and (tmp_path / OTHER).exists()
