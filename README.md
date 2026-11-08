# PermitReady Kitchener

A CommuniHacks prototype for the City of Kitchener's challenge: *how might technology help applicants submit complete building permit applications the first time?*

The applicant moves through seven steps:

1. **Project**: pick or type the kind of work.
2. **Preview**: a few questions decide whether a permit is likely needed. If not, you're done.
3. **Application**: the details from the permit application form.
4. **Requirements & uploads**: one document per page, with Previous/Next buttons and a progress bar at the bottom. *Placeholder for now:* uploading a page's PDF ticks every item on that page. The review service reports file problems (wrong format, unreadable, vague name, duplicate). Checking what each document shows will come from a custom review API, integrated later in `services/review`.
5. **Declaration**: the required declaration of applicant (the signature itself goes on the PDF form).
6. **Summary**: every unfinished item, each linking back to its page, plus a PDF summary to download.
7. **Confirmation**: "Application appears complete" or "Application incomplete".

> The result is preliminary guidance only. It is not confirmation that an application is complete, compliant or approved. Final requirements are determined through the City's application and review process.

All data is synthetic. This is not a City of Kitchener service.

## Run it

Needs Node 20+, pnpm and [uv](https://docs.astral.sh/uv/). Python is a uv workspace (`pyproject.toml` and `uv.lock` at the root, the service in `services/review`); uv installs the right Python and the packages into `.venv` by itself.

```bash
pnpm install
```

```bash
pnpm dev
```

That starts the review service (`uv run permit-review`, port 8000) and the web app (port 3000) together. Open http://localhost:3000 and load a sample application.

## Test it

```bash
pnpm typecheck && pnpm lint && pnpm test
```

```bash
pnpm test:review
```

```bash
pnpm test:e2e
```

| Suite | What it proves |
|---|---|
| `tests/golden` | All 7 InfoPkg scenarios give exactly the expected feedback; the control has zero findings |
| `services/review/tests` | File checks give the exact InfoPkg §8 messages (wrong format, unreadable, vague name, duplicate) |
| `tests/e2e` | Full browser flow: demo upload → results for all 7 scenarios, summary, questionnaire, file problems, axe accessibility |
| `tests/policy` | No approval language anywhere in the app or data |

## How it works

```
questions ─► engine ─► permit likely needed? + one page per document, with City links
uploads ─► @permit/files (instant checks) ─► /api/review ─► review service (services/review)
           review service: file checks now; the custom review API later → shown_details + findings
         ─► engine.evaluate ─► readiness report ─► summary + PDF
```

| Path | What |
|---|---|
| `packages/schema` | Zod contracts shared by everything (`docs/CONTRACTS.md`) |
| `packages/engine` | Pure rules engine: `classify`, `buildChecklist`, `evaluate` |
| `packages/files` | Browser checks (format, duplicates, vague names) + review client |
| `services/review` | FastAPI review service (uv app); where the custom review API will plug in |
| `apps/web` | Next.js app |
| `data/requirements` | Requirements per project: threshold questions, links and where-to-add text |
| `data/document-types.json` | Document labels |
| `data/` (other) | Project dropdown options, 7 scenarios (§6–7), City links |
| `fixtures/` | Synthetic sample PDFs and the §8 file cases |

Contributors and coding agents: read `AGENTS.md`. Demo script: `docs/DEMO.md`.
