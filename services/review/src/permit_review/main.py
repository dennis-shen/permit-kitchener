"""HTTP API: POST /review (multipart files[] + `submission` JSON) and GET /health."""
from __future__ import annotations

import json
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .checks import Upload
from .review import review as run_review

MAX_FILES = 30
MAX_BYTES = 20 * 1024 * 1024

app = FastAPI(title="PermitReady review service")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/review")
async def review(files: list[UploadFile] = File(...), submission: str = Form(...)) -> dict:
    if len(files) > MAX_FILES:
        raise HTTPException(413, f"At most {MAX_FILES} files per review.")
    try:
        sub = json.loads(submission)
    except json.JSONDecodeError as e:
        raise HTTPException(400, "submission must be JSON") from e
    uploads = []
    for f in files:
        data = await f.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(413, f"{f.filename} is larger than 20 MB.")
        uploads.append(Upload(f.filename or "upload", data))  # in memory only, never written to disk or logged
    return run_review(uploads, sub)


def run() -> None:
    """`uv run permit-review` — serves on PORT (default 8000)."""
    import uvicorn

    uvicorn.run("permit_review.main:app", host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")),
                reload=os.getenv("RELOAD", "") == "1")
