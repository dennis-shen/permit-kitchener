# Brief: Kiro-1 — Web App (Next.js UI)

You build everything the applicant sees and clicks. Use Kiro specs: create `.kiro/specs/web-app/{requirements.md,design.md,tasks.md}` from this brief before coding.

## Owns
`apps/web/` (except `apps/web/content/`, owned by Kiro-2).

## Read first
`AGENTS.md`, `docs/CONTRACTS.md`, `docs/PLAN.md §1` (data flow, "Every Finding carries a reference"), Overview docx "Who This Helps" & "What could you create?".

## Stack
Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, zustand (persist → localStorage), react-hook-form + Zod resolver (schemas from `@permit/schema`), `pdfjs-dist` for the viewer, `lucide-react` icons.

## Users
Homeowners (non-technical, mobile), contractors/designers (power users, many files), businesses (ICI), City staff (read-only summary view).

## Screens & behaviour
1. **App shell** — header "PermitReady Kitchener" + badge "Prototype · synthetic data"; footer with disclaimer (constant `DISCLAIMER` from schema) and link to City building permits page; responsive to 360 px.
2. **`/` Landing** — what it does in 3 bullets; buttons "Start my project" and "Try a demo scenario" (list the 7 scenarios from `data/scenarios`).
3. **`/classify`** — one-question-per-step wizard (copy from `apps/web/content/questionnaire.ts`, Kiro-2). Calls `classify()`. Shows result card: project type, permit likely required / may not be required / unknown + reasons. "Not sure" options always present → More information required path with link to City contact.
4. **`/checklist`** — `buildChecklist()` grouped by document (Application, Site plan, Floor plan…); each item: label, plain-language explanation, glossary tooltips, "Where to find guidance" link(s); print button.
5. **`/check`** — (a) application info form (§5.1 fields; validation inline); (b) dropzone upload (PDF/PNG/JPG, show size/type errors from `@permit/files` cheap checks immediately); (c) "Review my documents" → `POST /api/review` (server route that calls `@permit/files.reviewFiles` → vision → `evaluate`), progress UI per file. Fallback: if vision unavailable or a detail is `unclear`, show "My drawing shows…" checkboxes for that document's details.
6. **`/results`** — readiness banner (label + icon + colour, `aria-live`), counts by category; findings grouped **Missing / Incomplete / Unclear / Inconsistent / Wrong**. Each finding card: message, "How to fix", **Reference** panel (requirement label, InfoPkg section, City link, standard detail link), and **"Show me"** → document viewer: pdf.js page with highlighted bbox (expected-region dashed for missing), zoom/pan, page nav; inconsistent findings show both evidences side by side. Per-finding "I've addressed this / this is wrong" override (marks user-confirmed, re-evaluates). Item table with Complete/Incomplete/Missing/N/A chips.
7. **`/summary`** — printable report: application info, readiness, outstanding items with references, next steps, disclaimer; "Download JSON" (ReadinessReport) and "Print / Save PDF".
8. **`/staff`** (stretch) — compact reviewer view of the same report.

## State
`useSubmission` store: answers, classification, application, files (in memory only, never persisted), review response, overrides. Demo loader hydrates from scenario JSON and, if available, fixture files from `/fixtures` (served statically in dev).

## Rules
- Status never by colour alone (icon + text). Keyboard reachable everything. Focus moves to banner after review.
- No approval language; disclaimer on `/results` and `/summary` above the fold on mobile too.
- Until engine/vision land, mock with fixtures typed by `@permit/schema` (`apps/web/mocks/`).

## Tasks
K1.1 spec files · K1.2 shell + landing · K1.3 classify wizard · K1.4 checklist · K1.5 check form + upload · K1.6 `/api/review` route (with Lead) · K1.7 results + finding cards · K1.8 document viewer with bbox overlay + side-by-side · K1.9 summary/print/export · K1.10 mobile + a11y fixes from Kiro-2 audit · K1.11 staff view (stretch).

## Done when
Codex-C E2E flows 1–6 pass; Lighthouse a11y ≥ 95; works at 360 px.
