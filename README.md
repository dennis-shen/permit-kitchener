# PermitReady Kitchener

A CommuniHacks prototype for the City of Kitchener's challenge: *how might technology help applicants submit complete building permit applications the first time?*

The applicant moves through seven steps:

1. **Project**: pick or type the kind of work.
2. **Preview**: a few questions decide whether a permit is likely needed. If not, you're done.
3. **Application**: the details from the permit application form.
4. **Requirements & uploads**: one document per page, with Previous/Next buttons and a progress bar at the bottom. Every PDF page is rendered as an image, whether scanned or typed. A vision model checks the applicable JSON requirements and returns only booleans. Only positive decisions tick items; document contents are never extracted into the response.
5. **Declaration**: the required declaration of applicant (the signature itself goes on the PDF form).
6. **Summary**: every unfinished item, each linking back to its page, plus a PDF summary to download.
7. **Confirmation**: "Application appears complete" or "Application incomplete".

> The result is preliminary guidance only. It is not confirmation that an application is complete, compliant or approved. Final requirements are determined through the City's application and review process.

All data is synthetic. This is not a City of Kitchener service.

## Run it

Needs Node 22.19+ (24 LTS recommended), pnpm 12 and [uv](https://docs.astral.sh/uv/). Python is a uv workspace (`pyproject.toml` and `uv.lock` at the root, the service in `services/review`); uv installs the right Python and the packages into `.venv` by itself.

```bash
pnpm install
uv sync
```

Create `.env.local` at the **repository root** and enter `AI_GATEWAY_API_KEY` locally. This file is ignored by Git. Never put the key in chat, source, browser configuration, or logs. Restart the AI service after changing it. In a cloud environment, allow outbound HTTPS to `ai-gateway.vercel.sh`.

```bash
pnpm dev
```

That starts the review service (`uv run permit-review`, port 8000), the loopback AI SDK service (port 8101), and the web app (port 3000) together. Open http://localhost:3000 and press Start. Sample applications are at http://localhost:3000/samples (not linked from the app).

Production build:

```bash
pnpm build
```

```bash
pnpm start
```

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
| `services/review/tests` | File checks, typed/scanned rendering without OCR, protected PDFs, later pages, caching, and safe API failures |
| `tests/e2e` | Offline browser flow with fixture decisions: all 7 scenarios, summary, questionnaire, file problems, axe accessibility |
| `tests/policy` | No approval language anywhere in the app or data |

## How it works

```
questions ─► engine ─► permit likely needed? + one page per document, with City links
uploads ─► /api/files ─► review service (services/review): saved per browser session in .uploads/
           review service: file checks + PDF → PNG images → local AI SDK → Vercel AI Gateway
           strict boolean JSON → shown_details + findings (no extracted values)
         ─► engine.evaluate ─► readiness report ─► summary + PDF
```

| Path | What |
|---|---|
| `packages/schema` | Zod contracts shared by everything (`docs/CONTRACTS.md`) |
| `packages/engine` | Pure rules engine: `classify`, `buildChecklist`, `evaluate` |
| `packages/files` | Browser checks (format, duplicates, vague names) + review client |
| `services/review` | FastAPI service: saved uploads, PDF rendering, review caching and file checks |
| `packages/ai` | Server-only AI SDK: Gateway vision requests and strict boolean outputs |
| `apps/web` | Next.js app |
| `data/requirements` | Requirements per project: threshold questions, links and where-to-add text |
| `data/document-types.json` | Document labels |
| `data/` (other) | Project dropdown options, 7 scenarios (§6–7), City links |
| `fixtures/files/` | The §8 file cases (sample PDFs are in `apps/web/public/demo/`) |

Contributors and coding agents: read `AGENTS.md`. Demo script: `docs/DEMO.md`.

## Visual decisions

The default model is `google/gemini-2.5-flash-lite`, a low-cost vision model offered with Vercel AI Gateway credits. The free tier currently includes $5 per month for eligible models and has lower rate limits; availability and credits belong to your Vercel team. No Jev or provider API key is used. There is no automatic fallback to another model.

`packages/ai` uses AI SDK 7 `generateText` with `Output.object` and a strict Zod schema generated from `general.json` plus the project's requirement JSON. Each required key is a boolean. A phone number must look plausible; a signature needs a visible mark; neither value is returned. The same presence/plausibility policy applies to every field. Labels and blank boxes do not count, and earlier answers never count as PDF evidence. Optional fields remain optional in the engine.

PyMuPDF only opens and rasterizes PDFs (including annotations and form appearances), with no OCR or text extraction. The limits are 20 MB per file, 60 pages per PDF, a maximum image side of 3072 pixels, and four images per API call. Presence decisions are combined across all page batches; an API failure anywhere discards partial decisions. Encrypted, corrupt, empty and oversized documents are rejected. Size/page limits never silently truncate a document.

The AI service listens only on `127.0.0.1:8101`, rejects browser origins, limits request size/concurrency, and never logs SDK errors or document payloads. A failed check produces a visible warning and no ticks. Successful reviews are saved beside each upload and reused on reload; replacing/removing a file clears its cache. Context, requirement JSON and pipeline-version changes invalidate the cache. Unavailable reviews are retried and never cached. To force a fresh review, replace the PDF.

Unit and browser tests use deterministic API/model doubles and need no credentials or credits. They validate the integration, not the live model's visual accuracy. A live smoke test requires Gateway network access and credits; check both a typed and scanned synthetic control before relying on model quality.

With `pnpm dev` running against the production review service, run the opt-in live matrix:

```bash
uv run python scripts/live_review_smoke.py
```

For the Schedule 1 duplicate-label regression checks, run `uv run python scripts/live_bcin_smoke.py`. This opt-in live test uses typed and scanned synthetic declarations to check both selected BCIN locations, blank/placeholder values, a value under the wrong statement, and a missing declaration choice. BCIN fields are evaluated in their own focused visual schema; an unavailable or malformed API response discards the entire review, and no extracted values are returned.

This spends Gateway credits on typed and image-only synthetic controls, blank fields, missing signatures, placeholders and invalid field formats. It also checks the raw bridge's exact boolean keys. Results and synthetic PDFs go in ignored `work/live-validation/`. It never reads the credential file. To check failure handling, start the AI service with an intentionally invalid test credential in its process environment and run the same command with `--expect-unavailable`; restore the normal service afterward.

The four bundled control PDFs can be regenerated without network access using `uv run python scripts/live_review_smoke.py --write-control-fixtures`. Their drawings contain labelled geometry, and their form includes the current required fields; the golden scenario expectations are unchanged.

Visual review enables the model's reasoning mode and supplies field-type plausibility rules with each question. This reduced false positives found during live testing; model decisions still need human review. Pipeline-version changes invalidate previously cached decisions.

Documentation consulted on November 8, 2026:

- [AI Gateway with the AI SDK](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
- [Structured outputs](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Gemini 2.5 Flash Lite: model, images and input limits](https://vercel.com/ai-gateway/models/gemini-2.5-flash-lite)
- [Gateway pricing and free credits](https://vercel.com/docs/ai-gateway/pricing)
- [Gateway model eligibility for a team](https://vercel.com/docs/ai-gateway/sdks-and-apis/rest-api#team-availability-annotations)
- [Gateway reasoning configuration](https://vercel.com/docs/ai-gateway/models-and-providers/reasoning)
