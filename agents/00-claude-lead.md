# Brief: Claude — Lead / Architect / Integrator

You start first. Everyone else is blocked on your Phase 0. After that you are the reviewer, merger, and glue.

## Owns
Root config (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, eslint, prettier, `vitest.workspace.ts`), `packages/schema`, `docs/CONTRACTS.md`, `.github/workflows/ci.yml`, `docker-compose.yml`, `.env.example`, `.kiro/steering/`.

## Phase 0 — Foundation (target: 2–3 h)
**L0.1 Scaffold.** pnpm workspaces for `packages/*`, `apps/*`. TS strict, `noUncheckedIndexedAccess`. Scripts: `typecheck`, `lint`, `test`, `build` runnable with `pnpm -r`. Empty Next.js app in `apps/web` (Kiro-1 takes over). Python skeleton dir `services/vision` with `pyproject.toml` (Codex-B takes over).

**L0.2 `packages/schema`** — Zod schemas + inferred types for everything in `docs/PLAN.md §2`:
- Enums: `ProjectCategory`, `ProjectType` (`basement_renovation | deck_porch | detached_garage | residential_addition | solar_panels | ici_interior_alteration`), `DocumentType`, `ItemStatus`, `Readiness`, `FindingCategory`, `Severity`, `FileFindingCode`.
- `Requirement`, `DetailRequirement`, `Condition` (`{fact, eq|gte|lt|in}` + `all/any`), `PermitTrigger`.
- `QuestionnaireAnswers`, `ClassificationResult`, `ChecklistItem`.
- `Submission` (application / project_attributes / documents[{filename, document_type, present, shown_details[]}] / flags) — plus `parseInfoPkgJson()` accepting InfoPkg §9 verbatim.
- `Evidence {filename,page,bbox,cropUrl?,quote?,confidence,source}`, `Finding {id,category,severity,requirementId,detailId?,message,evidence[],conflictsWith?,reference{requirementLabel,infoPkgSection,cityUrl,standardDetailUrl?,howToFix},staffGuidance?}`.
- `ReadinessReport` (`formal_approval: z.literal(false)`, `disclaimer` literal).
- `VisionReviewRequest/Response` (mirror of `services/vision` API).
- Export `DISCLAIMER`, `READINESS_LABELS` constants.
- Generate JSON Schema to `packages/schema/json/*.json` (`zod-to-json-schema`) so Python can validate the same shapes; Codex-B generates pydantic models from it.

**L0.3 `docs/CONTRACTS.md`** — human-readable version of the schema + function signatures:
`classify(answers)`, `buildChecklist(type, attrs)`, `evaluate(submission, findings?)` (engine); `reviewFiles(files, submission)` (files client); `POST /review`, `GET /health` (vision); `explain(report)`, `classifyFreeText(text)` (ai). Include an example request/response for each.

**L0.4 Stubs** in `packages/engine|files|ai` exporting the signatures and throwing `not implemented`, so imports compile.

**L0.5 CI** (`ci.yml`): pnpm install (cache) → typecheck → lint → vitest → build web; parallel job: Python 3.11, install `services/vision`, `pytest`, `VLM_PROVIDER=none`. Later job: Playwright E2E with vision service via docker compose.

**L0.6** `docker-compose.yml` (web + vision), `.env.example` (`ANTHROPIC_API_KEY=`, `VLM_PROVIDER=none`, `VISION_URL=http://localhost:8000`).

**L0.7** `.kiro/steering/{product,tech,structure}.md` pointing Kiro agents to `AGENTS.md` and their briefs (done in repo already; keep in sync).

Exit criteria: `pnpm install && pnpm -r typecheck && pnpm -r test` green on `main`; tag `v0-contracts`; post "Phase 0 done" issue.

## Phase 1 — while others build
- Review every PR within one cycle: contract adherence, ownership, tests present, no approval language, disclaimer.
- Keep `docs/CONTRACTS.md` the truth; batch contract changes, never break silently.
- Maintain an integration board (GitHub issue "Integration status") listing each task id + state.

## Phase 2 — Integration (you lead)
- L2.1 Wire `apps/web` server route `/api/review` → `@permit/files` → vision → `@permit/engine.evaluate` → report. (Kiro-1 builds UI, you own the glue review.)
- L2.2 Run full golden + E2E suite, triage failures to owners.
- L2.3 AI-on vs AI-off parity check (same readiness & finding ids).
- L2.4 Security pass: file size limits (20 MB/file, 30 files), MIME sniffing, no files persisted to disk beyond request, no API key in client bundle.

## Phase 3 — Release
Deploy web (Vercel) + vision (Fly/Render), smoke test with demo scenarios, freeze `main`, tag `v1-demo`.

## Definition of done
All items in `docs/PLAN.md §7` checked.
