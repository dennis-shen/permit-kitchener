# Brief: Codex-C — Scenario Data, Synthetic Drawings & QA

You make the test world: the 7 scenarios as data, realistic fake drawings for the vision service to read, and the test suites that decide whether we're done.

## Owns
`data/scenarios/`, `data/file-cases/`, `fixtures/` (generator + outputs), `tests/golden/`, `tests/e2e/`, `tests/policy/`.

## Read first
`AGENTS.md`, `docs/CONTRACTS.md`, `docs/PLAN.md §3` (golden table), InfoPkg §6–9 (`docs/source/Info_Package.docx`), `data/requirements/INDEX.md` (detail ids from Codex-A).

## Tasks
**C1 — Scenario data** `data/scenarios/{MOCK-RES-001..004,MOCK-MISC-001,MOCK-ICI-001,MOCK-CONTROL-001}.json` in `Submission` shape. Copy every application field exactly (names, addresses, values, dates as ISO, declaration, signature). `documents[]` = InfoPkg "Submitted files" (include `present:false` for Missing ones); `shown_details` = "Information shown" mapped to detail ids, **omitting** "Deliberately missing". Add `expected: {readiness, messages[] (verbatim InfoPkg sentences), missing_item_count}`. MOCK-RES-002 must also round-trip from the InfoPkg §9 JSON (`fixtures/infopkg_s9.json`) via `parseInfoPkgJson`.

**C2 — File cases** `data/file-cases/file-cases.json`: FILE-001..008 `{testId, filename, condition, expectedCode, expectedMessage}` verbatim from §8.

**C3 — Synthetic drawing generator** `fixtures/generate.py` (reportlab + Pillow + pikepdf; deterministic seed; `python fixtures/generate.py` regenerates everything). For each scenario, produce every listed filename (e.g. `Basement_Floor_Plan.pdf`, `Deck_Side_View.pdf`, `Garage_Elevations.pdf`, `Code_Matrix.pdf`…) as simple, believable architectural sheets:
- title block (project address, drawing title, date, drawn-by, signature box), north arrow, scale;
- geometry: walls/rooms with labels, doors/windows, stairs, posts/joists/beams, property lines with dimension strings, nearby shed/pool, elevations with height dims, dashed existing vs solid new;
- notes (e.g. `2x10 JOISTS @ 16" O.C.`, `GUARD 1070 mm`, `CEILING HT 2.1 m`);
- the application form as a filled PDF (AcroForm) with declaration + signature field.
Include exactly the "Information shown" and omit the "Deliberately missing" items. Variants per sheet: `vector/`, `scanned/` (rasterised 150 DPI, noise, 1–2° skew, JPEG artefacts), `imperial/`.
Extra sets: `fixtures/files/` for FILE-001..008 (real DOCX, password PDF, `scan0004.pdf`, duplicate `SitePlan.pdf`, unsigned `ArchitecturalPlan.pdf`, `GaragePlan.pdf` with a different fake address, `CombinedFiles.pdf` site plan + floor plan + form, truncated `RoofPlan.pdf`); `fixtures/inconsistent/` (form deck height 0.9 m vs side view 0.75 m; garage form 6×7 vs plan 6×8; addition plan shows wall removal not in description).
Each output gets `<name>.truth.json`: `{document_type, shown_details[], absent_details[], bboxes{detail_id:[x0,y0,x1,y1]}}` in PDF points.
All addresses/names fictional (use the InfoPkg ones only).

**C4 — Golden tests** (`tests/golden`, Vitest): engine-only mode — for each scenario `evaluate(submission)` → readiness, exact message set, count, `formal_approval===false`, disclaimer; control → zero issues. Vision mode (`tests/golden/vision.spec.ts`, runs when `VISION_URL` set): upload generated files → engine → same expectations. File cases → exact messages.

**C5 — Policy tests** (`tests/policy`): grep built web output + `data/copy` for forbidden phrases (`approved`, `compliant`, `guaranteed`, `your application is complete`) outside the disclaimer; every result page snapshot contains the disclaimer; no real-looking emails/phones in data.

**C6 — E2E** (Playwright, `--trace off`): (1) classify → checklist → upload Scenario 2 deck files → 8 findings with highlight boxes → summary print view; (2) load each demo scenario → expected readiness; (3) control → "Appears ready to submit"; (4) FILE fixtures → messages; (5) inconsistency fixture → side-by-side values; (6) axe: no serious/critical violations.

**C7 — Vision eval harness** with Codex-B: `fixtures/eval_report.md` produced by `services/vision/eval.py` over all truth files; track recall/precision per variant in CI artefacts.

## Order
C2 → C1 (stubs with ids as soon as Codex-A publishes INDEX.md) → C4 → C3 (vector first, then scanned) → C5 → C6 → C7. Red tests before implementations land are expected; mark with `todo` only if the owner hasn't started.

## Done when
All suites wired into CI; fixtures regenerate deterministically; the golden table is enforceable by a single command `pnpm test:golden`.
