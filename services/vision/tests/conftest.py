import json
import pathlib

import pytest
from fastapi.testclient import TestClient

from app.main import app

ROOT = pathlib.Path(__file__).resolve().parents[3]
FIX = ROOT / "fixtures"


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


def scenarios():
    return [json.loads(p.read_text()) for p in sorted((ROOT / "data/scenarios").glob("*.json"))]


def post(client, paths, submission):
    files = [("files", (p.name, p.read_bytes(), "application/octet-stream")) for p in paths]
    r = client.post("/review", files=files, data={"submission": json.dumps(submission)})
    assert r.status_code == 200, r.text
    return r.json()
