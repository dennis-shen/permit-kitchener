# Brief: Kiro-2 — Content, Plain Language, AI Layer, Files Client & Demo

You own the words, the official references, the optional AI explanations, the browser-side file client, accessibility, and the pitch. Create `.kiro/specs/content/{requirements.md,design.md,tasks.md}` from this brief before starting.

## Owns
`data/copy/`, `data/resources.json`, `apps/web/content/`, `packages/ai/`, `packages/files/`, `docs/DEMO.md`, `docs/GLOSSARY.md`, `README.md`, pitch deck outline `docs/PITCH.md`.

## Read first
`AGENTS.md`, `docs/CONTRACTS.md`, InfoPkg §4 (public resources), §5–8, Overview docx "Important Design Consideration".

## Tasks
**K2.1 `data/resources.json`** — the 10 official City pages: building permits; apply for a building permit; residential building permits; ICI building permits; miscellaneous permits and applications; building applications and standard forms; building permit fees; standard details and guides (incl. detached garage/shed floating-slab, cross-section, mud-sill anchorage details); building and industry updates; online services portal. Fields `{id, title, url, description, lastVerified}`. Verify each URL on kitchener.ca and record date. Map each requirement's `resourceIds` with Codex-A.

**K2.2 `data/copy/messages.json`** — for every detail id in `data/requirements/INDEX.md`: `{missingMessage, incompleteMessage?, unclearMessage?, inconsistentMessage?, plainLanguage, whereToAdd, whyItMatters}`. Every expected-feedback sentence from InfoPkg §6–8 copied **verbatim** (golden tests compare exact strings). Others at grade-8 reading level, ≤ 25 words, active voice, no jargon without glossary.

**K2.3 `docs/GLOSSARY.md` + `apps/web/content/glossary.ts`** — guard, joist, beam, landing, site plan, key plan, elevation, section, code matrix, BCIN, professional engineer, floating slab, mud sill, o.c., aggregate area, ICI.

**K2.4 `apps/web/content/questionnaire.ts`** — questions, options (always with "Not sure"), help text and diagrams descriptions feeding Codex-A's `QuestionnaireAnswers` (agree field names with Codex-A first). Also landing-page and results microcopy, empty/error states.

**K2.5 `packages/files`** (TS client) — `reviewFiles(files, submission)`:
- in-browser cheap checks before upload: extension/MIME/magic bytes, size, duplicate SHA-256 (WebCrypto) and normalised-name duplicates, vague filenames → return `Finding[]` with exact FILE-00x messages;
- `POST` multipart to `/api/review` (server proxies to `VISION_URL`), timeout 60 s, typed via Zod; graceful fallback result `{visionUnavailable:true}` so UI shows manual checkboxes.
- Vitest with Codex-C `fixtures/files`.

**K2.6 `packages/ai`** — server-only:
- `explain(report)` → rewrites each finding's `howToFix` in plainer language keyed by finding id; must not add/remove findings; Zod-validated; fallback = messages.json text.
- `classifyFreeText(text)` → suggests `ProjectType` + follow-up questions from "describe your project"; fallback keyword classifier.
- Anthropic SDK, model `claude-sonnet-5-5`, `ANTHROPIC_API_KEY` optional; system prompt forbids approval language, inventing requirements, or legal advice. Tests run with key absent + a recorded-response mock.

**K2.7 Accessibility & content audit** — WCAG 2.1 AA checklist for Kiro-1; run axe; review all UI strings against forbidden-phrase list; check disclaimer placement.

**K2.8 Demo & pitch** — `docs/DEMO.md`: 3-minute script (deck MOCK-RES-002 upload → 8 findings with highlights → fix → control passes; show inconsistency side-by-side; show solar "permit may not be required" at 4 m²). `docs/PITCH.md`: problem, users, solution, how CV works, limits & safeguards, mapping to Overview "What Success Looks Like". `README.md`: setup (`pnpm i`, `docker compose up`, env vars), architecture diagram, team/agent map.

## Order
K2.1 → K2.2 (as soon as INDEX.md exists) → K2.4 → K2.5 → K2.6 → K2.3 → K2.7 → K2.8.

## Done when
Golden message tests pass on your text; files client passes FILE-001/003/004 in-browser; AI on/off parity; a11y audit issues filed and closed; demo rehearsed end-to-end.
