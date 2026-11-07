# Brief: Codex-B — Vision Document-Review Service (OpenCV + OCR + VLM)

You build the part that actually *reads* the uploaded forms and drawings and says what's missing, incomplete, unclear, inconsistent or wrong — with a pointer to where on the page and which requirement it relates to.

## Owns
`services/vision/` (Python 3.11, FastAPI). Nothing else.

## Read first
`AGENTS.md`, `docs/CONTRACTS.md` (`VisionReviewRequest/Response`, `Finding`, `Evidence`), `docs/PLAN.md §1 "Vision review pipeline"` + "Finding categories", `data/requirements/INDEX.md` (detail ids + `visionHints`), InfoPkg §8 (file cases).

## Stack
`fastapi`, `uvicorn`, `pymupdf`, `opencv-python-headless`, `numpy`, `paddleocr` (+ `pytesseract` fallback), `rapidfuzz`, `pydantic` v2 (models generated from `packages/schema/json` via `datamodel-code-generator`), `anthropic` (optional), `pytest`. Ship a `Dockerfile` (apt: `tesseract-ocr`, `libgl1`, `qpdf`).

## API
- `GET /health` → `{ok, ocr_engine, vlm_provider}`
- `POST /review` multipart: `files[]`, `submission` (JSON) → `{documents:[{filename, document_type, pages, shown_details[], confidence}], findings: Finding[], timings}`. Max 20 MB/file, 30 files. Never write uploads to disk except a tmp dir deleted after the request.
- Env: `VLM_PROVIDER=none|anthropic|local`, `ANTHROPIC_API_KEY`, `OCR_ENGINE=paddle|tesseract`, `REQUIREMENTS_DIR=../../data/requirements`.

## Pipeline modules (`app/`)
1. **`ingest.py`** — detect format by magic bytes (not extension). Non-PDF doc → `wrong` "Upload the plan as a PDF." (images PNG/JPG are accepted as scans). Encrypted → "Upload an unsecured version of the PDF." Open failure → "Replace the file with a readable copy." Extract vector text spans w/ bbox, AcroForm fields, signature fields; rasterize pages @200 DPI.
2. **`preprocess.py`** (OpenCV) — grayscale, deskew (Hough lines / minAreaRect), denoise, adaptive threshold, contour-based layout segmentation (drawing area, title block, notes, tables).
3. **`ocr.py`** — only for pages without vector text; returns `TextSpan{text,bbox,conf,page}`. Normalise bbox to PDF points so the UI overlay is unit-consistent.
4. **`detectors/`**
   - `title_block.py`: largest rectangle in bottom/right 30 %; parse project address, drawing title, date, drawn-by, signature box.
   - `doc_classifier.py`: filename + title text + keyword sets → `DocumentType`; ≥2 strong types on one file → `wrong` "Separate or label the documents so they can be identified." (FILE-007). Vague filename (`scan0004`, `IMG_…`, digits only) → `unclear` "Rename the file so its content can be identified." (FILE-003).
   - `dimensions.py` + `parsers/units.py`: metric/imperial (`3.6 m`, `11'-10"`, `2x10 @ 16" o.c.`, `1070 mm`), attach dimension to nearest label.
   - `labels.py`: fuzzy-match `visionHints` per detail id against spans (rapidfuzz ≥ 85).
   - `linestyle.py`: Hough segments → dashed vs solid / hatch ratio; addition plans with only one style → `unclear` existing-vs-proposed.
   - `signature.py`: signature field present / ink density in signature box / text "signed", plus date near it; missing → "Add the applicable signature before submission." (FILE-005).
   - `stamp.py`: Hough circles + text ("PROFESSIONAL ENGINEER", "BCIN") for PE/designer ID.
   - `parsers/address.py`: normalise and compare to `submission.application.property_address` → `inconsistent` "Confirm the correct project address." (FILE-006).
5. **`vlm.py`** — if enabled: page PNG + list of `{detail_id,label,hints}` for that document type → strict JSON `{detail_id, present, confidence, bbox, quote}`; validated by pydantic; one retry; on failure → ignore VLM. Prompt forbids judging compliance and inventing requirements.
6. **`fuse.py`** — rule hit ∨ (VLM present & conf ≥ 0.6) → shown; rule and VLM disagree or conf in [0.4,0.6) → `unclear` finding asking applicant to confirm; else not shown (engine marks incomplete).
7. **`checks/<project_type>.py`** — load requirement JSON, map evidence → `shown_details` per document. Never hardcode requirement lists.
8. **`consistency.py`** — cross-document: address; dimensions (form vs plan, e.g. garage 6×7 m); deck height (form vs side view); description vs drawings (demolition shown but not described; ICI previous use missing); duplicate files by SHA-256 or normalised name → "Confirm which version should be included." (FILE-004). Every `inconsistent` finding fills `evidence` and `conflictsWith`.
9. **`references.py`** — fill `Finding.reference` from requirement JSON + `data/resources.json`; for missing items set evidence bbox to the *expected region* (e.g. title-block signature box) with `source:"rule"`.

## Tasks (one PR each)
B1 skeleton + Docker + `/health` + stub `/review` · B2 ingest + FILE-001/002/008 · B3 preprocess + OCR + title block · B4 classifier + FILE-003/004/007 · B5 dimensions/labels/linestyle · B6 signature/stamp/address + FILE-005/006 · B7 checks per project type · B8 consistency · B9 VLM + fuse · B10 `eval.py` (per-detail precision/recall vs Codex-C's `*.truth.json`) + perf (≤ 10 s for a 5-file set on CPU without VLM).

## Tests
`pytest` on Codex-C fixtures (`fixtures/drawings`, `fixtures/files`). Until those land, generate tiny fixtures in `services/vision/tests/_tmp` with PyMuPDF.

## Done when
`VLM_PROVIDER=none`: all 8 FILE cases exact message; scenarios 1–7 `shown_details` produce the golden result through the engine; **control vector + scanned → zero findings**; recall ≥ 0.95. VLM mode never makes results worse on the golden set.
