import base64
import json

import pymupdf
import pytest

from permit_review import decisions, review, storage
from permit_review.checks import Upload
from conftest import pdf_bytes

REAL_CALL = decisions.call_decisions

GOOD = {"file.readable": True, "file.address_consistent": True, "file.labelled": True}
SUB = {"application": {"project_type": "deck_porch"}, "document_hints": {"Deck.pdf": "deck_plan"}}


@pytest.mark.parametrize("scanned", [False, True])
def test_typed_and_scanned_pdfs_send_images_without_text_extraction(monkeypatch, scanned):
    data = pdf_bytes("Synthetic field and signature mark")
    if scanned:
        with pymupdf.open(stream=data, filetype="pdf") as original, pymupdf.open() as scan:
            png = original[0].get_pixmap().tobytes("png")
            scan.new_page().insert_image(pymupdf.Rect(0, 0, 595, 842), stream=png)
            data = scan.tobytes()
    def no_text(*_args, **_kwargs):
        raise AssertionError("Text extraction must never run")
    monkeypatch.setattr(pymupdf.Page, "get_text", no_text)
    seen = []
    def api(images, _submission, doc_type):
        seen.extend(images)
        assert doc_type == "deck_plan"
        return {**GOOD, "deck.plan.beam_size": True, "deck.plan.joist_size": False}
    monkeypatch.setattr(decisions, "call_decisions", api)
    out = review.review([Upload("Deck.pdf", data)], SUB)
    assert out["documents"][0]["shown_details"] == ["deck.plan.beam_size"]
    assert out["documents"][0]["detail_evidence"] == {}
    assert base64.b64decode(seen[0]).startswith(b"\x89PNG\r\n\x1a\n")
    assert "Synthetic field" not in json.dumps(out)


def test_later_pages_count_but_contradictions_are_not_lost(monkeypatch):
    with pymupdf.open() as doc:
        for i in range(5):
            doc.new_page().insert_text((50, 50), f"Page {i}")
        data = doc.tobytes()
    batches = []
    def api(images, *_args):
        batches.append(len(images))
        return {**GOOD, "deck.plan.beam_size": len(batches) == 2,
                "file.address_consistent": len(batches) != 1}
    monkeypatch.setattr(decisions, "call_decisions", api)
    answers = decisions.inspect_pdf(data, SUB, "deck_plan")
    assert batches == [4, 2]
    assert answers["deck.plan.beam_size"] is True
    assert answers["file.address_consistent"] is False


def test_encrypted_corrupt_and_excessive_pdfs_never_reach_api(monkeypatch):
    monkeypatch.setattr(decisions, "call_decisions", lambda *_args: pytest.fail("API must not be called"))
    with pymupdf.open(stream=pdf_bytes(), filetype="pdf") as doc:
        protected = doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="synthetic", user_pw="synthetic")
    for data, code in [(protected, "PASSWORD_PROTECTED"), (b"%PDF-broken", "UNREADABLE")]:
        with pytest.raises(decisions.DocumentProblem) as exc:
            decisions.inspect_pdf(data, SUB, "deck_plan")
        assert exc.value.code == code
    monkeypatch.setattr(decisions, "MAX_PAGES", 0)
    with pytest.raises(decisions.DocumentProblem):
        decisions.inspect_pdf(pdf_bytes(), SUB, "deck_plan")


def test_failure_returns_no_ticks_and_no_exception_contents(monkeypatch):
    def api(*_args):
        raise decisions.DecisionsUnavailable("private provider request body")
    monkeypatch.setattr(decisions, "call_decisions", api)
    out = review.review([Upload("Deck.pdf", pdf_bytes())], SUB)
    assert out["documents"][0]["shown_details"] == []
    assert out["findings"][0]["id"].startswith("review:unavailable:")
    assert "private" not in json.dumps(out)


def test_later_batch_failure_discards_positive_decisions_and_is_not_cached(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "UPLOAD_DIR", tmp_path)
    with pymupdf.open() as doc:
        for i in range(5):
            doc.new_page().insert_text((50, 50), f"Synthetic page {i + 1}")
        data = doc.tobytes()
    calls = []

    def api(images, *_args):
        calls.append(len(images))
        if len(calls) % 2 == 0:
            raise decisions.DecisionsUnavailable("private provider response")
        return {**GOOD, "deck.plan.beam_size": True}

    monkeypatch.setattr(decisions, "call_decisions", api)
    saved = storage.save("a" * 32, "deck_plan", "Deck.pdf", "application/pdf", data, SUB)
    for _ in range(2):
        out = review.review_session([saved])[0]["review"]
        assert out["documents"][0]["shown_details"] == []
        assert any(f["id"].startswith("review:unavailable:") for f in out["findings"])
        assert "private" not in json.dumps(out)
        assert not saved.path.with_suffix(".review-cache").exists()
    assert calls == [4, 2, 4, 2]


def test_cache_avoids_repeat_calls_and_invalidates_on_replacement_or_context(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "UPLOAD_DIR", tmp_path)
    calls = []
    def api(*_args):
        calls.append(1)
        return {**GOOD, "deck.plan.beam_size": True}
    monkeypatch.setattr(decisions, "call_decisions", api)
    sid = "a" * 32
    s = storage.save(sid, "deck_plan", "Deck.pdf", "application/pdf", pdf_bytes(), SUB)
    review.review_session([s])
    review.review_session(storage.list_files(sid))
    assert len(calls) == 1
    s.submission["project_attributes"] = {"permanent_roof": True}
    review.review_session([s])
    assert len(calls) == 2
    s = storage.save(sid, "deck_plan", "Deck.pdf", "application/pdf", pdf_bytes("Replaced"), SUB)
    review.review_session([s])
    assert len(calls) == 3
    storage.delete(sid, "deck_plan")
    assert not list(tmp_path.rglob("*.review-cache"))


def test_unavailable_decisions_are_not_cached(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "UPLOAD_DIR", tmp_path)
    def api(*_args):
        raise decisions.DecisionsUnavailable()
    monkeypatch.setattr(decisions, "call_decisions", api)
    s = storage.save("a" * 32, "deck_plan", "Deck.pdf", "application/pdf", pdf_bytes(), SUB)
    review.review_session([s])
    assert not s.path.with_suffix(".review-cache").exists()


def test_pipeline_version_invalidates_saved_positive_decisions(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "UPLOAD_DIR", tmp_path)
    answers = {**GOOD, "deck.plan.beam_size": True}
    monkeypatch.setattr(decisions, "call_decisions", lambda *_args: answers)
    saved = storage.save("a" * 32, "deck_plan", "Deck.pdf", "application/pdf", pdf_bytes(), SUB)
    assert review.review_session([saved])[0]["review"]["documents"][0]["shown_details"] == ["deck.plan.beam_size"]
    answers["deck.plan.beam_size"] = False
    monkeypatch.setattr(review, "CACHE_VERSION", review.CACHE_VERSION + "-updated")
    assert review.review_session([saved])[0]["review"]["documents"][0]["shown_details"] == []


@pytest.mark.parametrize("response", [{"check": "true"}, {"check": 1}, [], {}, {"check": None}])
def test_http_boundary_rejects_non_boolean_outputs(monkeypatch, response):
    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            pass

        def read(self, _limit):
            return json.dumps(response).encode()

    class Opener:
        def open(self, request, timeout):
            payload = json.loads(request.data)
            assert "applicant_name" not in payload
            assert "signature_present" not in payload
            assert timeout == 70
            return Response()

    monkeypatch.setattr(decisions.urllib.request, "build_opener", lambda *_args: Opener())
    with pytest.raises(decisions.DecisionsUnavailable):
        REAL_CALL(["cG5n"], SUB, "deck_plan")


def test_header_and_values_across_batch_boundary_are_reviewed_together(monkeypatch):
    with pymupdf.open() as doc:
        for text in ["Cover one", "Cover two", "Cover three", "Exposed floors / Exterior doors", "Style A: floor assembly / insulated door"]:
            doc.new_page().insert_text((50, 50), text)
        data = doc.tobytes()
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        images = [base64.b64encode(p.get_pixmap(matrix=pymupdf.Matrix(2.5, 2.5), colorspace=pymupdf.csRGB, alpha=False).tobytes("png")).decode() for p in doc]
    seen = []
    def api(batch, *_args):
        seen.append(batch[:])
        return {**GOOD, "hvac.heat_construction.exterior_doors": images[3] in batch and images[4] in batch}
    monkeypatch.setattr(decisions, "call_decisions", api)
    out = decisions.inspect_pdf(data, SUB, "heat_loss_gain")
    assert seen == [images[:4], images[3:]]
    assert out["hvac.heat_construction.exterior_doors"] is True


def test_backend_configuration_invalidates_cached_decisions(tmp_path, monkeypatch):
    root = tmp_path / "repo"
    (root / "data/requirements").mkdir(parents=True)
    config = root / "data/ai-review.json"
    config.write_text('{"backend":"kiro"}')
    monkeypatch.setattr(review, "ROOT", root)
    monkeypatch.setattr(storage, "UPLOAD_DIR", tmp_path / "uploads")
    answers = {**GOOD, "deck.plan.beam_size": True}
    monkeypatch.setattr(decisions, "call_decisions", lambda *_args: answers)
    saved = storage.save("a" * 32, "deck_plan", "Deck.pdf", "application/pdf", pdf_bytes(), SUB)
    assert review.review_session([saved])[0]["review"]["documents"][0]["shown_details"] == ["deck.plan.beam_size"]
    config.write_text('{"backend":"gateway"}')
    answers["deck.plan.beam_size"] = False
    assert review.review_session([saved])[0]["review"]["documents"][0]["shown_details"] == []
