# AGENTS.md: review service (services/review)

This adds to the root `AGENTS.md`. A uv-managed FastAPI app (`src/` layout, package `permit_review`):
`POST /review` (multipart `files[]` and a `submission` JSON field) and `GET /health`. The contract is
`ReviewRequest` / `ReviewResponse` in `packages/schema`.

## Commands (from the repo root; this is a member of the root uv workspace, which holds `uv.lock`)
- Install: `uv sync`
- Run: `uv run permit-review` (port 8000; `PORT`, `HOST` and `RELOAD=1` change that)
- Test: `uv run pytest -q`
- Add a dependency: `uv add --package permit-review <pkg>` (test tools: `uv add --dev <pkg>`, root `dev` group). Commit `uv.lock`. Never use pip.

## Layout
- `src/permit_review/main.py`: HTTP endpoints and limits (30 files, 20 MB each): `POST /review` (no saving) and `/sessions/{sid}/files[/{page}]` (GET list, PUT save, DELETE remove; `DELETE /sessions/{sid}` clears). Each returns the session's full list with reviews.
- `src/permit_review/checks.py`: file checks from the name and bytes only: wrong format, unreadable
  (a `.pdf` without a PDF header), duplicate. **Nothing here reads document contents.**
- `src/permit_review/review.py`: runs file checks, calls the visual Decisions API, maps true keys to `shown_details` and caches successful reviews beside uploads. No field values or invented evidence.
- `src/permit_review/decisions.py`: PyMuPDF opens and renders every PDF page to PNG (no OCR/text extraction), then calls the loopback AI SDK service at `127.0.0.1:8101/decisions`. Batches and page/image limits must never silently drop pages. All partial decisions are discarded if any batch fails.
- `packages/ai`: the TypeScript AI SDK service owns the Gateway credentials. Python never needs the key. Tests stub the API boundary, not PDF rendering.

## Rules
- Saved uploads live in `src/permit_review/storage.py`: `.uploads/<session>/<page>.bin` + `.json` (`PERMIT_UPLOAD_DIR`, `PERMIT_UPLOAD_TTL_DAYS`). Session ids and page names are validated before touching the disk. Never log file contents.
- The web app sends one file per request (one per document page), with `document_hints` naming the page.
