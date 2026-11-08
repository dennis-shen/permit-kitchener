# AGENTS.md: review service (services/review)

This adds to the root `AGENTS.md`. A uv-managed FastAPI app (`src/` layout, package `permit_review`):
`POST /review` (multipart `files[]` and a `submission` JSON field) and `GET /health`. The contract is
`ReviewRequest` / `ReviewResponse` in `packages/schema`.

## Commands (run here)
- Install: `uv sync`
- Run: `uv run permit-review` (port 8000; `PORT`, `HOST` and `RELOAD=1` change that)
- Test: `uv run pytest -q`
- Add a dependency: `uv add <pkg>` (dev only: `uv add --dev <pkg>`). Commit `uv.lock`. Never use pip.

## Layout
- `src/permit_review/main.py`: HTTP endpoints and limits (30 files, 20 MB each).
- `src/permit_review/checks.py`: file checks from the name and bytes only: wrong format, unreadable
  (a `.pdf` without a PDF header), vague name, duplicate. **Nothing here reads document contents.**
- `src/permit_review/review.py`: builds the response. **This is where the custom review API (hosted on
  localhost) will be called**; it will fill `shown_details` / `detail_evidence` per document and the
  remaining InfoPkg §8 checks (password-protected, missing signature, address mismatch, combined documents).
  Until then documents come back with no details, and the web app runs in placeholder mode.

## Rules
- Uploads stay in memory; never write them to disk or log their contents.
- The web app sends one file per request (one per document page), with `document_hints` naming the page.
