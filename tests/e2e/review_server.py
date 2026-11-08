"""Offline browser-test boundary, never imported by production.

Known synthetic PDF hashes map to fixture truth. Rendering and the actual AI SDK's structured
output path are tested independently in test_decisions.py and decisions.test.ts. No key needed.
"""
import hashlib
import json

from permit_review import review
from permit_review.storage import ROOT
from permit_review.main import run

truth = {}
for path in (ROOT / "data" / "scenarios").glob("*.json"):
    scenario = json.loads(path.read_text())
    for doc in scenario["documents"]:
        pdf = ROOT / "apps" / "web" / "public" / "demo" / scenario["application"]["application_id"] / doc["filename"]
        if pdf.exists():
            truth[(hashlib.sha256(pdf.read_bytes()).hexdigest(), doc["document_type"])] = doc["shown_details"]


def fixture_decisions(data, _submission, document_type):
    return {"file.readable": True, "file.address_consistent": True, "file.labelled": True,
            **{key: True for key in truth.get((hashlib.sha256(data).hexdigest(), document_type), [])}}


review.inspect_pdf = fixture_decisions
run()
