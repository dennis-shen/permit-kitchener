"""End-to-end vision tests over the generated fixtures (python fixtures/generate.py)."""
import json

import pytest

from app.review import details_for
from conftest import FIX, post, scenarios

SCENARIOS = scenarios()


def test_health(client):
    assert client.get("/health").json()["ok"] is True


@pytest.mark.parametrize("variant", ["vector", "scanned"])
@pytest.mark.parametrize("s", SCENARIOS, ids=lambda s: s["application"]["application_id"])
def test_scenario_reads_exactly_what_is_shown(client, s, variant):
    aid = s["application"]["application_id"]
    present = [d for d in s["documents"] if d["present"]]
    out = post(client, [FIX / "drawings" / variant / aid / d["filename"] for d in present],
               {"application": s["application"], "project_attributes": s["project_attributes"]})
    by_name = {d["filename"]: d for d in out["documents"]}
    ptype = s["application"]["project_type"]
    deliberately_missing = set()
    for d in present:
        deliberately_missing |= {det["id"] for _, det in details_for(ptype, d["document_type"])} - set(d["shown_details"])
    # details not on any document at all are also missing
    all_shown = {x for d in present for x in d["shown_details"]}
    deliberately_missing -= all_shown
    for d in present:
        got = by_name[d["filename"]]
        assert got["document_type"] == d["document_type"], d["filename"]
        assert set(d["shown_details"]) <= set(got["shown_details"]), (d["filename"], set(d["shown_details"]) - set(got["shown_details"]))
        assert not (set(got["shown_details"]) & deliberately_missing), (d["filename"], set(got["shown_details"]) & deliberately_missing)
        for did in got["shown_details"]:
            assert got["detail_evidence"][did]["filename"] == d["filename"]
    # Scenario files are clean: no file problems, and the form signature matches the application.
    assert [f for f in out["findings"] if f.get("fileCode")] == []
    assert out["form_fields"].get("signature_present") == s["application"]["signature_present"]


EXPECTED = {
    "FILE-001": "Upload the plan as a PDF.",
    "FILE-002": "Upload an unsecured version of the PDF.",
    "FILE-003": "Rename the file so its content can be identified.",
    "FILE-004": "Confirm which version should be included.",
    "FILE-005": "Add the applicable signature before submission.",
    "FILE-006": "Confirm the correct project address.",
    "FILE-007": "Separate or label the documents so they can be identified.",
    "FILE-008": "Replace the file with a readable copy.",
}
GARAGE = next(s for s in SCENARIOS if s["application"]["application_id"] == "MOCK-RES-003")


@pytest.mark.parametrize("case", sorted(EXPECTED))
def test_file_cases(client, case):
    out = post(client, sorted((FIX / "files" / case).iterdir()),
               {"application": GARAGE["application"], "project_attributes": GARAGE["project_attributes"]})
    msgs = [f["message"] for f in out["findings"] if f.get("fileCode")]
    assert msgs == [EXPECTED[case]], msgs
    f = next(f for f in out["findings"] if f.get("fileCode"))
    assert f["evidence"] and f["reference"]["cityUrl"].startswith("https://")


def test_address_mismatch_shows_both_values(client):
    out = post(client, [FIX / "files/FILE-006/GaragePlan.pdf"], {"application": GARAGE["application"], "project_attributes": {}})
    f = next(f for f in out["findings"] if f.get("fileCode") == "ADDRESS_MISMATCH")
    assert f["category"] == "inconsistent"
    assert "55 Different Road" in f["evidence"][0]["value"] and f["conflictsWith"][0]["value"] == GARAGE["application"]["property_address"]
    assert f["evidence"][0]["bbox"]


def test_deck_height_inconsistency(client):
    sub = json.loads((FIX / "inconsistent/deck_height/submission.json").read_text())
    out = post(client, [FIX / "inconsistent/deck_height/Deck_Side_View.pdf"], sub)
    f = next(f for f in out["findings"] if f["category"] == "inconsistent")
    assert f["evidence"][0]["value"] == 0.75 and f["conflictsWith"][0]["value"] == 0.9


def test_addition_wall_removal_is_inferred(client):
    s = next(s for s in SCENARIOS if s["application"]["application_id"] == "MOCK-RES-004")
    d = next(d for d in s["documents"] if d["document_type"] == "proposed_floor_plan")
    out = post(client, [FIX / "drawings/vector/MOCK-RES-004" / d["filename"]], {"application": s["application"], "project_attributes": {}})
    assert out["inferred_attributes"].get("removes_existing_exterior_wall") is True


def test_previews_are_returned(client):
    out = post(client, [FIX / "drawings/vector/MOCK-RES-002/Deck_Plan.pdf"], {"application": SCENARIOS[1]["application"], "project_attributes": {}})
    assert out["documents"][0]["previews"][0]["png_base64"]


def test_slot_hint_overrides_classification(client):
    """A vaguely named file uploaded to the 'deck plan' slot is reviewed as a deck plan."""
    s = next(x for x in SCENARIOS if x["application"]["application_id"] == "MOCK-RES-002")
    data = (FIX / "drawings/vector/MOCK-RES-002/Deck_Plan.pdf").read_bytes()
    files = [("files", ("drawing.pdf", data, "application/pdf"))]
    sub = {"application": s["application"], "project_attributes": {}, "document_hints": {"drawing.pdf": "deck_plan"}}
    r = client.post("/review", files=files, data={"submission": json.dumps(sub)}).json()
    assert r["documents"][0]["document_type"] == "deck_plan"
    assert "deck.plan.posts" in r["documents"][0]["shown_details"]


def test_checks_come_from_json_config():
    from app.checks import CHECKS
    from app.config import DETAILS, DOCUMENT_TYPES, FORMS
    assert DETAILS["deck.side_view.guard_height"].patterns, "regex patterns load from data/requirements"
    assert DETAILS["ici.plumbing_plan.professional_stamp"].check == "stamp"
    assert {d.check for d in DETAILS.values()} <= set(CHECKS)
    assert "deck_side_view" in DOCUMENT_TYPES
    assert FORMS["ontario-permit-application-2026"]["sections"][0]["id"] == "A"
