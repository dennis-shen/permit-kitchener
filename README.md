# PermitReady Kitchener

A CommuniHacks prototype for the City of Kitchener's challenge: *how might technology help applicants submit complete building permit applications the first time?*

An applicant answers a few plain-language questions, gets a checklist for their project, then **uploads their application form and drawings**. A document-review service built on **OpenCV, Tesseract OCR and PyMuPDF** (with an optional vision-language model) reads every field and annotation and flags what is **missing, incomplete, unclear, inconsistent or wrong**. Each finding comes with **evidence** (file, page, highlighted box, quoted text) and a **reference** (the requirement, the InfoPkg section, the official City page, and how to fix it).

> The result is preliminary guidance only. It is not confirmation that an application is complete, compliant or approved. Final requirements are determined through the City's application and review process.

All data is synthetic. This is not a City of Kitchener service.

## Run it

Needs Node 20+, pnpm, Python 3.11+ and `tesseract-ocr`.

```bash
pnpm install
```

```bash
python3 -m venv services/vision/.venv && services/vision/.venv/bin/pip install -e "services/vision[dev]"
```

```bash
(cd services/vision && .venv/bin/uvicorn app.main:app --port 8000) &
```

```bash
pnpm --filter @permit/web build && VISION_URL=http://localhost:8000 pnpm --filter @permit/web start
```

Open http://localhost:3000 and pick a demo application. Or run everything with Docker:

```bash
docker compose up --build
```

Optional: set `ANTHROPIC_API_KEY` for plain-language rewrites, plus `VLM_PROVIDER=anthropic` for AI-assisted drawing reading. Without them everything runs deterministically.

## Test it

```bash
pnpm typecheck && pnpm lint && pnpm test
```

```bash
(cd services/vision && .venv/bin/pytest -q)
```

```bash
pnpm test:e2e
```

| Suite | What it proves |
|---|---|
| `tests/golden` | All 7 InfoPkg scenarios give exactly the expected feedback; the control has zero findings |
| `services/vision/tests` | The reviewer reads exactly what each generated drawing shows, for clean **and scanned** copies; FILE-001…008 give the exact §8 messages; address and deck-height mismatches are caught |
| `tests/e2e` | Full browser flow: demo upload → results for all 7 scenarios, highlight viewer, summary, questionnaire, file problems, axe accessibility |
| `tests/policy` | No approval language anywhere in the app or data |

## How it works

```
questionnaire ─► engine.classify ─► project type + permit trigger
                 engine.buildChecklist ─► checklist with City links
uploads ─► @permit/files (instant checks) ─► /api/vision ─► vision service
           vision: PyMuPDF text + render → OpenCV deskew/denoise/threshold → Tesseract (scans)
                   → document type → per-detail patterns from data/requirements
                   → OpenCV signature-ink and seal detection → cross-document consistency
                   → optional VLM confirmation → shown_details + evidence + findings
         ─► engine.evaluate ─► readiness report ─► results / highlight viewer / summary
```

| Path | What |
|---|---|
| `packages/schema` | Zod contracts shared by everything (`docs/CONTRACTS.md`) |
| `packages/engine` | Pure rules engine: `classify`, `buildChecklist`, `evaluate` |
| `packages/files` | Browser checks (format, duplicates, vague names) + review client |
| `packages/ai` | Optional plain-language layer with deterministic fallback |
| `services/vision` | FastAPI document reviewer (OpenCV, OCR, PyMuPDF, optional VLM) |
| `apps/web` | Next.js app |
| `data/` | Requirements (InfoPkg §5), 7 scenarios (§6–7), City links |
| `fixtures/generate.py` | Synthetic drawing generator (vector + scanned) and §8 file cases |

See `docs/DEMO.md` for a 3-minute demo script.
