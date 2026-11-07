"""PermitReady vision document-review service. Contract: docs/CONTRACTS.md §5."""
from __future__ import annotations

import json
import os
import time

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from . import vlm
from .ingest import load
from .review import review as run_review

MAX_FILES = 30
MAX_BYTES = 20 * 1024 * 1024

app = FastAPI(title="PermitReady vision service")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "ocr_engine": os.getenv("OCR_ENGINE", "tesseract"),
            "vlm_provider": os.getenv("VLM_PROVIDER", "none"), "vlm_active": vlm.enabled()}


@app.post("/review")
async def review(files: list[UploadFile] = File(...), submission: str = Form(...)) -> dict:
    if len(files) > MAX_FILES:
        raise HTTPException(413, f"At most {MAX_FILES} files per review.")
    try:
        sub = json.loads(submission)
    except json.JSONDecodeError as e:
        raise HTTPException(400, "submission must be JSON") from e
    t0 = time.perf_counter()
    uploads = []
    for f in files:
        data = await f.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(413, f"{f.filename} is larger than 20 MB.")
        uploads.append(load(f.filename or "upload", data))  # kept in memory only, never written to disk
    t1 = time.perf_counter()
    out = run_review(uploads, sub)
    out["timings"] = {"ingest_ms": round((t1 - t0) * 1000), "review_ms": round((time.perf_counter() - t1) * 1000)}
    return out
