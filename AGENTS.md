# AGENTS.md — PermitReady Kitchener (shared rules for ALL agents)

Read this file first, then **your own brief** in `agents/`, then `docs/PLAN.md` (full architecture) and `docs/CONTRACTS.md` (frozen interfaces, written by the Lead in Phase 0).

| Agent | Brief | Owns |
|---|---|---|
| Claude (Lead / Architect) | `agents/00-claude-lead.md` | scaffold, `packages/schema`, `docs/CONTRACTS.md`, CI, `docker-compose.yml`, integration & merges |
| Codex-A (Rules Engine) | `agents/01-codex-a-engine.md` | `packages/engine`, `data/requirements` |
| Codex-B (Vision Service) | `agents/02-codex-b-vision.md` | `services/vision` |
| Codex-C (Fixtures & QA) | `agents/03-codex-c-qa.md` | `fixtures/`, `data/scenarios`, `data/file-cases`, `tests/` |
| Kiro-1 (Web UI) | `agents/04-kiro-1-ui.md` | `apps/web` |
| Kiro-2 (Content, AI & Files client) | `agents/05-kiro-2-content.md` | `data/copy`, `data/resources.json`, `packages/ai`, `packages/files`, `docs/DEMO.md`, `README.md` |

## 1. What we are building (30-second version)
CommuniHacks — City of Kitchener Challenge #1: *"How might technology, innovative service design or clearer guidance help applicants submit complete building permit applications the first time?"*

**PermitReady** is a web app where an applicant:
1. answers plain-language questions → we **classify** the project (basement, deck/porch, detached garage, addition, solar, ICI interior alteration) and decide if a permit is likely required;
2. gets a **personalised checklist** with plain-language explanations and links to official City pages;
3. **uploads their application form and drawings** → an **OpenCV + OCR + vision-language-model** service reads every field/annotation and flags anything **missing, incomplete, unclear, inconsistent or wrong**, each with **evidence** (file, page, highlighted box, quoted text) and a **reference** (requirement broken, InfoPkg section, City URL, how to fix);
4. gets a readiness result + printable **summary**.

Source material: `docs/source/` (Challenge_Overview.docx, Info_Package.docx = "InfoPkg", Kitchener_Challenge_Brief.pdf). InfoPkg §5 = mock requirements, §6 = 6 incomplete scenarios, §7 = control scenario, §8 = file-validation cases, §9 = sample JSON, §10 = data dictionary.

## 2. Non-negotiable rules
1. **Synthetic data only.** No real names, addresses, permits. Never scrape the City portal.
2. **Never approve.** `formal_approval` is always `false`. Never output "approved", "compliant", "guaranteed", or "your application is complete" as a determination.
3. **Disclaimer, verbatim, on every result/summary screen and in every report JSON:**
   > The result is preliminary guidance only. It is not confirmation that an application is complete, compliant or approved. Final requirements are determined through the City's application and review process.
4. **Link, don't copy.** Requirements always point to the official City page (`data/resources.json`).
5. **Readiness labels (exact):** "Appears ready to submit" · "Action required" · "More information required" · "Staff guidance recommended". **Item statuses:** Complete · Incomplete · Missing · Not applicable. **Finding categories:** missing · incomplete · unclear · inconsistent · wrong.
6. **Acceptance bar:** 6 incomplete scenarios → exact expected feedback; control MOCK-CONTROL-001 → **zero** findings; FILE-001..008 → exact expected messages. A false positive on the control is a release blocker.
7. **Works offline from AI.** With no `ANTHROPIC_API_KEY` / `VLM_PROVIDER=none`, everything still runs deterministically and passes CI.

## 3. Stack (decided — do not relitigate)
TypeScript, Node 20, pnpm workspaces · Next.js 14 App Router + Tailwind + shadcn/ui · Zod · Vitest · Playwright (`--trace off`) · Python 3.11 + FastAPI + OpenCV + PyMuPDF + PaddleOCR/Tesseract + pydantic + pytest for `services/vision` · VLM: `claude-sonnet-5-5` vision behind `VLM_PROVIDER` flag.

## 4. Repo layout
```
AGENTS.md  agents/  docs/{PLAN.md,CONTRACTS.md,DEMO.md,source/}
packages/{schema,engine,files,ai}   services/vision   apps/web
data/{requirements,scenarios,file-cases,copy}/ data/resources.json
fixtures/{generate.py,drawings/,files/}   tests/{golden,e2e}
.github/workflows/ci.yml   docker-compose.yml   .kiro/steering/
```

## 5. Workflow
- **Ownership:** only edit directories you own. Need a change elsewhere → open a GitHub issue titled `[for <Agent>] …` and keep going with a local stub.
- **Branches:** `agent/<agent-name>/<task-id>-<slug>` (e.g. `agent/codex-a/T1.3-evaluate`). One task = one PR into `main`. Lead (Claude) reviews and merges.
- **Contracts:** `docs/CONTRACTS.md` + `packages/schema` are the only interface. Changes only via Lead PR; announce in the PR title `CONTRACT:`.
- **Before every PR:** `pnpm -r typecheck && pnpm -r lint && pnpm -r test` (and `pytest services/vision` if you touched Python). Include tests for what you added.
- **Commits:** `<area>: <imperative summary>` — e.g. `engine: add deck permit trigger`.
- **Ambiguity:** follow the golden table in `docs/PLAN.md §3`; else choose the conservative option (flag rather than hide) — except never create a false positive on the control.
- **PR description:** what/why, task id, how tested, screenshots for UI.

## 6. Phases
- **Phase 0** (Lead only, blocks all): scaffold, schema, contracts, stubs, CI. Others may read/plan in the meantime.
- **Phase 1** (all in parallel): see each brief.
- **Phase 2** integration: UI ↔ engine ↔ vision ↔ AI; E2E; a11y.
- **Phase 3** polish, deploy, demo.
