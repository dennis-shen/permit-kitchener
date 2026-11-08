"""Saved uploads, one PDF per document page per browser session.

Layout: <UPLOAD_DIR>/<session id>/<page>.bin (the file) and <page>.json (name, type, size, sha256,
upload time, and the submission it was uploaded with). UPLOAD_DIR defaults to `.uploads/` at the
repo root (gitignored); set PERMIT_UPLOAD_DIR to change it. Sessions untouched for
PERMIT_UPLOAD_TTL_DAYS (default 7) are deleted when the service starts.
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import shutil
import time
from dataclasses import dataclass

ROOT = pathlib.Path(__file__).resolve().parents[4]  # services/review/src/permit_review/storage.py → repo root
UPLOAD_DIR = pathlib.Path(os.getenv("PERMIT_UPLOAD_DIR", ROOT / ".uploads"))
TTL_SECONDS = float(os.getenv("PERMIT_UPLOAD_TTL_DAYS", "7")) * 86400

SESSION_RX = re.compile(r"^[a-f0-9]{32}$")
PAGE_RX = re.compile(r"^[a-z_]{1,40}$")


class InvalidKey(ValueError):
    pass


@dataclass
class Stored:
    page: str
    id: str
    name: str
    type: str
    size: int
    sha256: str
    uploaded_at: int  # ns since epoch
    submission: dict
    path: pathlib.Path

    def read(self) -> bytes:
        return self.path.read_bytes()

    def meta(self) -> dict:
        return {"id": self.id, "name": self.name, "type": self.type, "size": self.size, "uploaded_at": self.uploaded_at}


def _session_dir(sid: str) -> pathlib.Path:
    if not SESSION_RX.match(sid):
        raise InvalidKey("bad session id")
    return UPLOAD_DIR / sid


def _check_page(page: str) -> str:
    if not PAGE_RX.match(page):
        raise InvalidKey("bad page")
    return page


def save(sid: str, page: str, name: str, content_type: str, data: bytes, submission: dict) -> Stored:
    d = _session_dir(sid)
    _check_page(page)
    d.mkdir(parents=True, exist_ok=True)
    sha = hashlib.sha256(data).hexdigest()
    now = time.time_ns()
    meta = {"id": f"{sha[:12]}-{now}", "name": name, "type": content_type, "size": len(data), "sha256": sha,
            "uploaded_at": now, "submission": submission}
    # write to temp names, then swap in, so a page never holds half a file
    tmp_bin, tmp_json = d / f".{page}.bin.tmp", d / f".{page}.json.tmp"
    tmp_bin.write_bytes(data)
    tmp_json.write_text(json.dumps(meta))
    os.replace(tmp_bin, d / f"{page}.bin")
    os.replace(tmp_json, d / f"{page}.json")
    (d / f"{page}.review-cache").unlink(missing_ok=True)
    return _load(d, page)  # type: ignore[return-value]


def _load(d: pathlib.Path, page: str) -> Stored | None:
    mp, bp = d / f"{page}.json", d / f"{page}.bin"
    if not (mp.exists() and bp.exists()):
        return None
    m = json.loads(mp.read_text())
    return Stored(page=page, id=m["id"], name=m["name"], type=m["type"], size=m["size"], sha256=m["sha256"],
                  uploaded_at=m["uploaded_at"], submission=m.get("submission") or {}, path=bp)


def list_files(sid: str) -> list[Stored]:
    d = _session_dir(sid)
    if not d.exists():
        return []
    os.utime(d)  # keeps an active session from being swept
    out = [s for p in sorted(d.glob("*.json")) if (s := _load(d, p.stem))]
    return sorted(out, key=lambda s: s.uploaded_at)


def delete(sid: str, page: str) -> None:
    d = _session_dir(sid)
    _check_page(page)
    for p in (d / f"{page}.bin", d / f"{page}.json", d / f"{page}.review-cache"):
        p.unlink(missing_ok=True)


def clear(sid: str) -> None:
    shutil.rmtree(_session_dir(sid), ignore_errors=True)


def sweep(now: float | None = None) -> None:
    """Delete sessions not touched within the TTL."""
    if not UPLOAD_DIR.exists():
        return
    cutoff = (now or time.time()) - TTL_SECONDS
    for d in UPLOAD_DIR.iterdir():
        if d.is_dir() and SESSION_RX.match(d.name) and d.stat().st_mtime < cutoff:
            shutil.rmtree(d, ignore_errors=True)
