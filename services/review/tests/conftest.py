"""File/session tests exercise real PDF rendering with a deterministic Decisions API boundary."""
import pymupdf
import pytest

from permit_review import decisions


def pdf_bytes(text="Synthetic document"):
    with pymupdf.open() as doc:
        page = doc.new_page()
        page.insert_text((50, 50), text)
        return doc.tobytes()


@pytest.fixture(autouse=True)
def local_decisions(monkeypatch):
    monkeypatch.setattr(decisions, "call_decisions", lambda *_args: {
        "file.readable": True, "file.address_consistent": True, "file.labelled": True,
    })
