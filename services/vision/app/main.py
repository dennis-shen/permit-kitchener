"""Vision document-review service. OWNER: Codex-B. Contract: docs/CONTRACTS.md §5."""
import json
import os

from fastapi import FastAPI, File, Form, UploadFile

app = FastAPI(title="PermitReady vision service")


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "ocr_engine": os.getenv("OCR_ENGINE", "tesseract"),
        "vlm_provider": os.getenv("VLM_PROVIDER", "none"),
    }


@app.post("/review")
async def review(files: list[UploadFile] = File(...), submission: str = Form(...)) -> dict:
    """Phase 0 stub: returns a contract-shaped empty response."""
    json.loads(submission)
    return {
        "documents": [
            {"filename": f.filename or "", "document_type": "other", "pages": 0, "shown_details": [], "confidence": 0.0}
            for f in files
        ],
        "findings": [],
        "timings": {},
        "vlm_used": False,
    }
