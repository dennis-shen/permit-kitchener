"""HTTP API.

- POST /review: review files without saving them (multipart files[] + `submission` JSON).
- /sessions/{sid}/files: the saved upload for each document page of one browser session.
  GET lists them with their reviews; PUT /sessions/{sid}/files/{page} saves (replaces) a page's file;
  DELETE …/{page} removes it; DELETE /sessions/{sid} removes everything.
  Every call returns the session's full list, so the app can simply replace its state.
"""
from __future__ import annotations

import json
import os

from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from . import storage

from .checks import Upload
from .review import review as run_review
from .review import review_session

MAX_FILES = 30
MAX_BYTES = 20 * 1024 * 1024



@asynccontextmanager
async def lifespan(_app: FastAPI):
    storage.sweep()
    yield


app = FastAPI(title="PermitReady review service", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/review")
async def review(files: list[UploadFile] = File(...), submission: str = Form(...)) -> dict:
    if len(files) > MAX_FILES:
        raise HTTPException(413, f"At most {MAX_FILES} files per review.")
    try:
        sub = json.loads(submission)
        if not isinstance(sub, dict):
            raise ValueError()
    except ValueError as e:
        raise HTTPException(400, "submission must be JSON") from e
    uploads = []
    for f in files:
        data = await f.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(413, f"{f.filename} is larger than 20 MB.")
        uploads.append(Upload(f.filename or "upload", data))  # in memory only; never logged
    return await run_in_threadpool(run_review, uploads, sub)


def _session(sid: str) -> dict:
    try:
        return {"files": review_session(storage.list_files(sid))}
    except storage.InvalidKey as e:
        raise HTTPException(400, str(e)) from e


@app.get("/sessions/{sid}/files")
def list_files(sid: str) -> dict:
    return _session(sid)


@app.put("/sessions/{sid}/files/{page}")
async def save_file(sid: str, page: str, file: UploadFile = File(...), submission: str = Form("{}")) -> dict:
    try:
        sub = json.loads(submission)
        if not isinstance(sub, dict):
            raise ValueError()
    except ValueError as e:
        raise HTTPException(400, "submission must be JSON") from e
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"{file.filename} is larger than 20 MB.")
    try:
        # contents are saved as-is and never logged
        storage.save(sid, page, file.filename or "upload", file.content_type or "application/octet-stream", data, sub)
    except storage.InvalidKey as e:
        raise HTTPException(400, str(e)) from e
    return await run_in_threadpool(_session, sid)


@app.delete("/sessions/{sid}/files/{page}")
def delete_file(sid: str, page: str) -> dict:
    try:
        storage.delete(sid, page)
    except storage.InvalidKey as e:
        raise HTTPException(400, str(e)) from e
    return _session(sid)


@app.delete("/sessions/{sid}")
def clear_session(sid: str) -> dict:
    try:
        storage.clear(sid)
    except storage.InvalidKey as e:
        raise HTTPException(400, str(e)) from e
    return {"files": []}


def run() -> None:
    """`uv run permit-review` — serves on PORT (default 8000)."""
    import uvicorn

    uvicorn.run("permit_review.main:app", host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")),
                reload=os.getenv("RELOAD", "") == "1")
