# PermitReady Kitchener

A CommuniHacks prototype for the City of Kitchener's challenge: *how might technology help applicants submit complete building permit applications the first time?*

The applicant moves through seven steps:

1. **Project**: pick or type the kind of work.
2. **Preview**: a few questions decide whether a permit is likely needed. If not, you're done.
3. **Application**: the details from the permit application form.
4. **Requirements & uploads**: one document per page, with Previous/Next buttons and a progress bar at the bottom. *Placeholder for now:* uploading a page's PDF ticks every item on that page. A document reviewer built on **PyMuPDF and OpenCV** still reports file problems (wrong format, password-protected, unreadable, address mismatch), and its field-by-field checks can be switched back on (`PLACEHOLDER_TICKS` in `apps/web/lib/review.ts`).
5. **Declaration**: the required declaration of applicant (the signature itself goes on the PDF form, which the reviewer checks).
6. **Summary**: every unfinished item, each linking back to its page, plus a PDF summary to download.
7. **Confirmation**: "Application appears complete" or "Application incomplete".

> The result is preliminary guidance only. It is not confirmation that an application is complete, compliant or approved. Final requirements are determined through the City's application and review process.

All data is synthetic. This is not a City of Kitchener service.

## Run it

Needs Node 20+, pnpm and Python 3.11+.

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

Open http://localhost:3000 and load a sample application. Or run everything with Docker:

```bash
docker compose up
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
| `services/vision/tests` | The reviewer reads exactly what each generated drawing shows; FILE-001…008 give the exact §8 messages; fillable form fields are read; address and deck-height mismatches are caught |
| `tests/e2e` | Full browser flow: demo upload → results for all 7 scenarios, highlight viewer, summary, questionnaire, file problems, axe accessibility |
| `tests/policy` | No approval language anywhere in the app or data |

## How it works

```
questionnaire ─► engine.classify ─► project type + permit trigger
                 engine.buildChecklist ─► checklist with City links
uploads ─► @permit/files (instant checks) ─► /api/vision ─► vision service
           vision: PyMuPDF text + render (no OCR) → OpenCV signature/seal detection
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
| `services/vision` | FastAPI document reviewer (PyMuPDF, OpenCV, optional VLM; no OCR) |
| `apps/web` | Next.js app |
| `data/requirements` | Requirements per project: threshold questions, links, where-to-add text and **editable vision checks** |
| `data/vision` | Document-type recognition rules and the Ontario permit form field map |
| `data/` (other) | Project dropdown options, 7 scenarios (§6–7), City links |
| `fixtures/generate.py` | Synthetic drawing generator, fillable test forms and §8 file cases |

Contributors and coding agents: read `AGENTS.md`. Demo script: `docs/DEMO.md`.
