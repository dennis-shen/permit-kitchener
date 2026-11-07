import json

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["ok"] is True


def test_review_stub_shape():
    r = client.post(
        "/review",
        files=[("files", ("Site_Plan.pdf", b"%PDF-1.4", "application/pdf"))],
        data={"submission": json.dumps({"application": {}, "project_attributes": {}})},
    )
    body = r.json()
    assert r.status_code == 200
    assert set(body) >= {"documents", "findings", "timings", "vlm_used"}
