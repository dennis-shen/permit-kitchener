"""Loads everything the reviewer checks from editable JSON (no code change needed to tune checks).

- data/requirements/*.json      → per-detail `vision` blocks: check kind, regex patterns, fuzzy hints
- data/vision/document-types.json → how files are classified (filename + title rules) and document labels
- data/vision/forms/*.json       → field maps for known forms (e.g. the Ontario permit application)
- data/resources.json            → City links used in finding references

Set REQUIREMENTS_DIR / RESOURCES_FILE / VISION_CONFIG_DIR to point elsewhere (the Docker image uses /data).
"""
from __future__ import annotations

import json
import os
import pathlib
import re
from dataclasses import dataclass, field

_HERE = pathlib.Path(__file__).resolve()
# Repo checkout: services/vision/app/config.py → repo root. In Docker the env vars point at /data instead.
ROOT = _HERE.parents[3] if len(_HERE.parents) > 3 else _HERE.parent
REQ_DIR = pathlib.Path(os.getenv("REQUIREMENTS_DIR", ROOT / "data/requirements"))
RES_FILE = pathlib.Path(os.getenv("RESOURCES_FILE", ROOT / "data/resources.json"))
VISION_DIR = pathlib.Path(os.getenv("VISION_CONFIG_DIR", REQ_DIR.parent / "vision"))


@dataclass
class DetailCheck:
    """A requirement detail plus its compiled vision configuration."""

    id: str
    label: str
    requirement_id: str
    check: str = "text"
    patterns: list[re.Pattern] = field(default_factory=list)
    hints: list[str] = field(default_factory=list)
    form_field: str | None = None
    raw: dict = field(default_factory=dict)


def _load_sets() -> dict[str, dict]:
    out = {}
    for p in sorted(REQ_DIR.glob("*.json")):
        d = json.loads(p.read_text())
        out[d["projectType"]] = d
    return out


SETS: dict[str, dict] = _load_sets()
RESOURCES: dict[str, dict] = {r["id"]: r for r in json.loads(RES_FILE.read_text())} if RES_FILE.exists() else {}
FALLBACK_URL = RESOURCES.get("apply-for-building-permit", {}).get("url", "https://www.kitchener.ca/")

_doc_cfg_path = VISION_DIR / "document-types.json"
DOC_CFG: dict = json.loads(_doc_cfg_path.read_text()) if _doc_cfg_path.exists() else {"filenameRules": [], "titleRules": [], "documentTypes": []}
FILENAME_RULES = [(re.compile(r["pattern"], re.I), r["type"]) for r in DOC_CFG["filenameRules"]]
TITLE_RULES = [(re.compile(r["pattern"], re.I), r["type"]) for r in DOC_CFG["titleRules"]]
DOCUMENT_TYPES = {d["type"]: d for d in DOC_CFG["documentTypes"]}

FORMS: dict[str, dict] = {}
for _p in sorted((VISION_DIR / "forms").glob("*.json")) if (VISION_DIR / "forms").exists() else []:
    _f = json.loads(_p.read_text())
    FORMS[_f["id"]] = _f


def _compile(det: dict, req_id: str) -> DetailCheck:
    v = det.get("vision", {}) or {}
    return DetailCheck(
        id=det["id"], label=det["label"], requirement_id=req_id, check=v.get("check", "text"),
        patterns=[re.compile(p, re.I) for p in v.get("patterns", [])], hints=v.get("hints", []),
        form_field=v.get("formField"), raw=det,
    )


DETAILS: dict[str, DetailCheck] = {
    d["id"]: _compile(d, r["id"]) for s in SETS.values() for r in s["requirements"] for d in r["details"]
}


def details_for(ptype: str, dtype: str) -> list[tuple[dict, dict]]:
    """(requirement, detail) pairs checked on a document of this type (one PDF per page: own document type only)."""
    out = []
    for key in ("general", ptype):
        for r in SETS.get(key, {}).get("requirements", []):
            if r["id"] == "general.application":
                continue
            if dtype == r["documentType"]:
                out += [(r, d) for d in r["details"]]
    return out
