# AGENTS.md: document reviewer (services/vision)

This adds to the root `AGENTS.md`. It is a FastAPI service: `POST /review` (multipart `files[]` and a `submission` JSON field) and `GET /health`. The contract is `VisionReviewRequest` / `VisionReviewResponse` in `packages/schema`.

## Layout
- `app/config.py`: loads all checks from `data/` (requirement `vision` blocks, document-type rules, form maps). Paths can be overridden with `REQUIREMENTS_DIR`, `RESOURCES_FILE` and `VISION_CONFIG_DIR`.
- `app/checks.py`: check registry (`text`, `stamp`, `signature_and_date`, `every_elevation_has_height`, `form_field`, `none`). Add new kinds here with `@register`.
- `app/ingest.py`: file sniffing, encryption and readability checks, vector text with positions, and the OCR fallback.
- `app/ocr.py`: OpenCV deskew, denoise and threshold, then Tesseract.
- `app/detectors.py`: OpenCV signature-ink and seal detection.
- `app/review.py`: classification (the page's `document_hints` override the rules), per-detail checks (only details whose requirement has the same `documentType`: one PDF per page), file findings (FILE-001…008) and consistency with the application (address, deck height).
- `app/vlm.py`: optional vision-model confirmation (`VLM_PROVIDER=anthropic`).

## How the web app calls it
The web app sends **one file per request** (one per document page) as soon as it is uploaded. Duplicate files across pages are caught in the browser (`@permit/files` precheck). The service still accepts several files per request (the tests use this).

## Rules
- Prefer changing `data/` over code when tuning detection.
- Every finding needs `evidence` (file, page, box if known) and a `reference` with a City URL.
- Keep the reviewer deterministic with `VLM_PROVIDER=none`. Tests run that way.
- Test with `.venv/bin/pytest -q`. The tests run every scenario's clean and scanned fixtures, so regenerate fixtures (`python fixtures/generate.py` from the repo root) after changing annotations.
