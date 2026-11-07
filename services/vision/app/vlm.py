"""Optional vision-language-model pass for details the rules could not find.

Enabled with VLM_PROVIDER=anthropic and ANTHROPIC_API_KEY. The model sees the page image
and the list of details still missing, and must answer in strict JSON. It can only add
details it reports as present with confidence >= 0.6; any error falls back to rules only.
"""
from __future__ import annotations

import base64
import json
import os

from pydantic import BaseModel, Field, ValidationError

MODEL = os.getenv("VLM_MODEL", "claude-sonnet-5-5")
SYSTEM = (
    "You review building-permit drawings for a City of Kitchener prototype. For each listed detail, say whether it is "
    "visibly shown on the page. A measurement detail counts only if its value is written. Do not judge code compliance, "
    "do not approve anything, and do not invent requirements. Reply with JSON only."
)


class Item(BaseModel):
    detail_id: str
    present: bool
    confidence: float = Field(ge=0, le=1)
    quote: str | None = None
    bbox: list[float] | None = None  # PDF points


class Answer(BaseModel):
    items: list[Item]


def enabled() -> bool:
    return os.getenv("VLM_PROVIDER", "none") == "anthropic" and bool(os.getenv("ANTHROPIC_API_KEY"))


def confirm(up, details: list[dict]) -> dict[str, dict]:
    try:
        import anthropic
    except ImportError:
        return {}
    if not up.doc:
        return {}
    out: dict[str, dict] = {}
    client = anthropic.Anthropic()
    for i, page in enumerate(up.doc, start=1):
        if i > 3:
            break
        png = base64.b64encode(page.get_pixmap(dpi=110).tobytes("png")).decode()
        ask = [{"detail_id": d["id"], "label": d["label"], "hints": (d.get("vision") or {}).get("hints", [])} for d in details if d["id"] not in out]
        if not ask:
            break
        prompt = (f"Page size {page.rect.width:.0f}x{page.rect.height:.0f} points. Details: {json.dumps(ask)}. "
                  'Return {"items":[{"detail_id","present","confidence","quote","bbox"}]}.')
        for _ in range(2):
            try:
                msg = client.messages.create(model=MODEL, max_tokens=1500, system=SYSTEM, messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": png}},
                    {"type": "text", "text": prompt}]}])
                text = "".join(b.text for b in msg.content if b.type == "text")
                ans = Answer.model_validate_json(text[text.find("{"): text.rfind("}") + 1])
                for it in ans.items:
                    if it.present and it.confidence >= 0.6 and it.detail_id in {a["detail_id"] for a in ask}:
                        out[it.detail_id] = {"filename": up.filename, "page": i, "confidence": it.confidence, "source": "vlm",
                                             "expectedRegion": False, **({"bbox": it.bbox} if it.bbox and len(it.bbox) == 4 else {}),
                                             **({"quote": it.quote} if it.quote else {})}
                break
            except (ValidationError, ValueError, Exception):
                continue
    return out
