# PermitReady Kitchener — Multi-Agent Build Plan

## 0. Context (read this first, every agent)

**What this is:** A CommuniHacks hackathon prototype for the City of Kitchener, Challenge #1 "Complete Building Permit Applications."
**Challenge question:** *How might technology, innovative service design or clearer guidance help applicants submit complete building permit applications the first time?*

**Problem:** Applicants (homeowners, contractors, designers, businesses) don't know which requirements apply to their project, so they submit incomplete applications → City staff follow-up, delays, admin cost.

**What we build:** a web app, "PermitReady", that does four things end-to-end:
1. **Classify** — plain-language questionnaire → project type (+ "is a permit even required?" for decks/solar).
2. **Checklist** — project-specific required items with plain-language explanations and links to official City pages.
3. **Automated document review (core feature)** — applicant uploads the application form + drawings (PDF/images). A **computer-vision + OCR + vision-language-model pipeline** reads every field and drawing annotation, then flags anything **missing, incomplete, unclear, inconsistent or wrong**. Every finding comes with **evidence** (page + highlighted bounding box + extracted text) and a **reference** (the requirement it breaks, the City page/standard detail to consult, and what to add). Engine returns per-item status (Complete / Incomplete / Missing / Not applicable) and an overall result. Manual "my drawing shows…" checkboxes remain only as a fallback/override when CV confidence is low.
4. **Summary** — printable/exportable report of outstanding items and next steps; plus a **file validator** (format, password, unclear name, duplicates, etc.).

**Hard constraints (non-negotiable):**
- The repo is currently empty (`README.md` only). Everything is greenfield.
- All data is **synthetic**. Never use real people/addresses. `formal_approval` is always `false`.
- Every result screen MUST show this disclaimer verbatim:
  > The result is preliminary guidance only. It is not confirmation that an application is complete, compliant or approved. Final requirements are determined through the City's application and review process.
- Link to official City pages rather than presenting copied requirements as current.
- The tool **supports**, never replaces, City review/professional advice. No "approved" language anywhere.
- **Success metric:** all 6 incomplete scenarios produce exactly the expected feedback; control scenario (MOCK-CONTROL-001) produces *zero* issues ("Appears ready to submit"); all 8 FILE-00x cases produce the expected message.

**Source docs** (copy into repo at `docs/source/` in Task 0): Overview docx, InfoPkg docx, Kitchener PDF. Section numbers below (§5.x, §6, §8) refer to the InfoPkg.

---

## 1. Architecture

### Stack (decided — do not relitigate)
- **TypeScript everywhere**, Node 20, **pnpm workspaces** monorepo.
- **Next.js 14 (App Router)** + **Tailwind** + **shadcn/ui** for the web app.
- **Zod** for all schemas (single source of truth for types + runtime validation).
- **Vitest** for unit/golden tests, **Playwright** for E2E.
- **pdf-lib** / **pdfjs-dist** for file validation (encryption, readability, page text for address check).
- Optional LLM layer (plain-language rewriting / free-text classification) behind an interface with a **deterministic fallback**; the rules engine never depends on it. Default model: `claude-sonnet-5-5` via env `ANTHROPIC_API_KEY`; app works fully with key absent.
- No database. State lives in browser (URL + localStorage). Data is static JSON in the repo.
- **Document-review service (`services/vision`) — Python 3.11 + FastAPI**, because the CV ecosystem lives in Python:
  - **PyMuPDF (fitz)**: open PDFs, detect encryption/unreadable, extract vector text with coordinates, AcroForm fields, digital-signature fields; rasterize pages at 200 DPI.
  - **OpenCV**: deskew, denoise, adaptive threshold; detect title block (largest bottom-right rectangle), dimension lines/arrows, line-style classification (dashed vs solid → existing vs proposed), signature-box ink density, stamp (circle/seal) detection, page layout segmentation to spot combined documents.
  - **PaddleOCR** (fallback Tesseract via `pytesseract`) for scanned pages; returns text + bbox + confidence.
  - **Vision-language model** (`claude-sonnet-5-5` vision via Anthropic API, behind `VLM_PROVIDER` flag; swappable for a local model like Qwen2-VL): given page image + the requirement list for that document type, returns structured JSON of which details are present, with bbox and quote. Used for semantic questions OpenCV can't answer ("is the furnace labelled?", "is the shed shown?").
  - **Rule-based field parsers** (regex + units): dimensions (`6.0 m`, `19'-8"`, `2x10 @ 16" o.c.`), heights, addresses, dates, PE/BCIN numbers, signatures.
  - Docker image `services/vision/Dockerfile`; Next.js calls it via `VISION_URL`. If VLM key absent → OCR+rules only, low-confidence items fall back to manual checkboxes.
- Deploy: Vercel for web + Fly.io/Render (or `docker compose up`) for the vision service.

### Repo layout
```
permit-kitchener/
├─ package.json / pnpm-workspace.yaml / tsconfig.base.json / .eslintrc / .prettierrc
├─ AGENTS.md                      # agent rules (this plan condensed) — Codex reads this
├─ .kiro/steering/*.md            # same rules for Kiro (product.md, tech.md, structure.md)
├─ docs/
│  ├─ source/                     # original docx/pdf
│  ├─ PLAN.md                     # this file
│  └─ CONTRACTS.md                # schema + API contracts (§2), frozen after Task 0
├─ data/                          # @permit/data — pure JSON + Zod validation
│  ├─ requirements/*.json         # one file per project type (§5.1–5.7)
│  ├─ scenarios/*.json            # 7 scenarios (§6, §7)
│  ├─ file-cases/file-cases.json  # FILE-001..008 (§8)
│  ├─ resources.json              # official City links
│  └─ copy/messages.json          # plain-language strings
├─ packages/
│  ├─ schema/      # Zod schemas + inferred types  (OWNER: Codex-A)
│  ├─ engine/      # pure rules engine: classify, checklist, evaluate (Codex-A)
│  ├─ files/       # file validator (Codex-B)
│  └─ ai/          # optional LLM adapter + fallback (Codex-B)
├─ services/vision/  # Python FastAPI document-review service (Codex-B)
│  ├─ app/main.py           # POST /review, GET /health
│  ├─ app/ingest.py         # PyMuPDF load, encryption/readability, rasterize
│  ├─ app/preprocess.py     # OpenCV deskew/threshold/segment
│  ├─ app/ocr.py            # PaddleOCR/Tesseract → TextSpan[]
│  ├─ app/detectors/        # title_block.py, dimensions.py, linestyle.py, signature.py, stamp.py, doc_classifier.py
│  ├─ app/parsers/          # units.py, address.py, dates.py, credentials.py
│  ├─ app/vlm.py            # VLM prompt + JSON schema validation
│  ├─ app/checks/           # per project type: maps evidence → shown_details + Findings
│  ├─ app/consistency.py    # cross-document checks
│  └─ tests/ (pytest + fixtures)
├─ fixtures/drawings/     # synthetic PDFs/PNGs per scenario (Codex-C generates)
├─ apps/web/       # Next.js UI (Kiro-1 UI, Kiro-2 content/a11y)
└─ tests/
   ├─ golden/      # scenario → expected output tests (Codex-C)
   └─ e2e/         # Playwright (Codex-C)
```

### Data flow
```
Questionnaire answers ──► engine.classify() ──► ProjectType + permitRequired?
                                                     │
                                                     ▼
                                     engine.buildChecklist(type, attrs) ──► ChecklistItem[]
                                                     │
Application info + Documents + "shown details" ──►  engine.evaluate(submission) ──► ReadinessReport
Uploaded files ──► files.validate(file[], application) ──► FileFinding[]  ──┘ (merged into report)
                                                     │
                                       ai.explain(report)? (optional polish, fallback = copy table)
                                                     ▼
                                     UI: Checklist / Results / Summary (print + JSON export)
```
Engine is **pure and synchronous** (no I/O) so it runs in the browser and in tests identically.

### Vision review pipeline (per uploaded file)
```
upload ─► ingest (PyMuPDF: encrypted? readable? vector text? form fields? sig fields?)
       ─► rasterize pages ─► OpenCV preprocess ─► layout segmentation
       ─► doc_classifier (filename + title block text + keywords + VLM) ─► DocumentType (+ "combined" if >1)
       ─► extractors: OCR spans, dimensions, labels, line styles, signature/stamp boxes
       ─► VLM pass: "for this <document type> of a <project type>, which of these details are present? return {detail_id, present, confidence, bbox, quote}"
       ─► fuse (rules ∧ VLM; disagreement or conf<0.6 → status "unclear", ask user)
       ─► per-file Evidence + Findings
all files ─► consistency.py (cross-doc) ─► Findings
         ─► shown_details[] per document ─► engine.evaluate() ─► ReadinessReport (with evidence attached)
```

### Finding categories (what "review the fields" means concretely)
| Category | Examples | How detected |
|---|---|---|
| **Missing** | no foundation detail, no key plan, no electrical plan | expected DocumentType not classified among uploads |
| **Incomplete** | window sizes absent, guard height absent, no joist spacing | required detail not found by OCR/VLM on the right document |
| **Unclear** | `scan0004.pdf`, low-res scan, existing vs new not distinguishable, illegible dimension | filename rules; OCR confidence < threshold; linestyle detector finds only one style on an addition plan |
| **Inconsistent** | address on drawing ≠ form (FILE-006); deck height 0.9 m on form vs 0.75 m on side view; garage 6×7 m on form vs 6×8 on plan; description omits wall removal shown on plan; value mismatch | `consistency.py` compares normalized fields across form, description and all drawings |
| **Wrong** | DOCX instead of PDF, password-protected, unreadable, combined types, deck <0.61 m but described as needing permit, solar <5 m², guard height below the value stated on the plan's own note, unsigned/undated professional drawing | ingest + rule parsers |

### Every Finding carries a reference
```ts
Finding = {
  id, category: "missing"|"incomplete"|"unclear"|"inconsistent"|"wrong",
  severity: "blocker"|"warning"|"info",
  requirementId, detailId?, message,              // exact copy from messages.json
  evidence: { filename, page, bbox:[x0,y0,x1,y1], cropUrl?, quote?, confidence, source:"vector"|"ocr"|"vlm"|"rule" }[],
  conflictsWith?: Evidence[],                     // for inconsistent: both sides shown
  reference: { requirementLabel, infoPkgSection: "§5.3", cityUrl, standardDetailUrl?, howToFix }
}
```
UI shows the page with the bbox highlighted (or, for missing items, the region where it's expected — e.g. title block for signatures), side-by-side for inconsistencies, and the City link.

---

## 2. Contracts (Codex-A writes these in Task 0; everyone codes against them)

### 2.1 Core enums
```ts
ProjectCategory = "Residential" | "ICI" | "Miscellaneous"
ProjectType = "basement_renovation" | "deck_porch" | "detached_garage" | "residential_addition" | "solar_panels" | "ici_interior_alteration"
ItemStatus = "complete" | "incomplete" | "missing" | "not_applicable"
Readiness = "appears_ready" | "action_required" | "more_info_required" | "staff_guidance_recommended"
```
Display labels: "Appears ready to submit", "Action required", "More information required", "Staff guidance recommended".

### 2.2 Requirement definition (`data/requirements/<type>.json`)
```ts
Requirement = {
  id: string                    // e.g. "deck.site_plan.property_line_distances"
  label: string                 // "Distance from the deck to property lines"
  plainLanguage: string         // homeowner-readable explanation
  documentType: DocumentType    // which document should carry it ("Site plan", "Construction drawing", "Application", ...)
  details?: DetailRequirement[] // sub-items checked on that document
  appliesWhen?: Condition       // e.g. {fact:"has_kitchen_or_bathroom", eq:true}
  resourceIds: string[]         // → resources.json
}
DetailRequirement = { id, label, missingMessage, appliesWhen? }
PermitTrigger (deck): height_m >= 0.61 OR permanent_roof === true
PermitTrigger (solar): mounted_to_building AND area_m2 >= 5
```
Every project type also inherits the **General application info** requirement (§5.1): applicant name, property address, applicant role, project type, project description, estimated construction value, application date, declaration, signature.

### 2.3 Submission (input to `evaluate`) — superset of InfoPkg §9 JSON
```ts
Submission = {
  application: { application_id, applicant_name, property_address, applicant_role,
                 project_category, project_type, project_description,
                 estimated_construction_value, submission_method, submission_date,
                 declaration_completed: boolean, signature_present: boolean }
  project_attributes: Record<string, number|boolean|string>  // deck_height_metres, permanent_roof, aggregate_panel_area_m2, ...
  documents: { filename, document_type, present: boolean, shown_details: string[] /*DetailRequirement ids*/ }[]
  flags?: { unusual_aspects?: string[] }   // → staff_guidance_recommended
}
```
Key design: the engine computes `complete`/`issues` from `shown_details` vs requirements; it does **not** trust a provided `complete` flag. Scenario files encode what's *shown*; expected output encodes what's *missing*.

### 2.4 Output
```ts
ReadinessReport = {
  application_id, project_type, permit_required: boolean | "unknown",
  readiness: Readiness,
  items: { requirementId, label, status: ItemStatus, issues: {detailId, message}[], resources: Resource[] }[],
  file_findings: FileFinding[],
  missing_item_count: number,
  formal_approval: false,          // literal type
  disclaimer: string
}
FileFinding = { testId?: string, filename, code: "WRONG_FORMAT"|"PASSWORD_PROTECTED"|"UNCLEAR_NAME"|"DUPLICATE"|"SIGNATURE_MISSING"|"ADDRESS_MISMATCH"|"COMBINED_TYPES"|"UNREADABLE", message }
```

### 2.5 Readiness logic (exact)
1. If project type cannot be determined → `more_info_required`.
2. Else if `flags.unusual_aspects` non-empty (e.g. change of use unclear, multi-unit, heritage) → `staff_guidance_recommended` (still list issues).
3. Else if any applicable item is `incomplete`/`missing` OR any file finding → `action_required`.
4. Else → `appears_ready`.
- Item status: not applicable if `appliesWhen` false; missing if no document of the right type present; incomplete if present but any applicable detail absent from `shown_details`; else complete.
- Deck/solar where trigger is false → `permit_required:false`, show "A permit may not be required — confirm with the City" (still not a determination).

### 2.6 Engine API (`@permit/engine`)
```ts
classify(answers: QuestionnaireAnswers): { projectType: ProjectType | null, category, permitRequired: boolean|"unknown", reasons: string[] }
buildChecklist(type: ProjectType, attrs): ChecklistItem[]
evaluate(sub: Submission, fileFindings?: FileFinding[]): ReadinessReport
```
### 2.7 Files API (`@permit/files`)
```ts
validateFiles(files: {name, bytes: Uint8Array}[], ctx: {propertyAddress, projectType}): Promise<FileFinding[]>
```
Rules (§8): non-PDF → "Upload the plan as a PDF." · encrypted → "Upload an unsecured version of the PDF." · name matches `/^(scan|img|document|file)\d*|^\d+$/i` → "Rename the file so its content can be identified." · same normalized name or SHA-256 → "Confirm which version should be included." · no signature text/field on architectural/professional docs → "Add the applicable signature before submission." · address in PDF text ≠ application → "Confirm the correct project address." · keywords of ≥2 document types / name "Combined" → "Separate or label the documents so they can be identified." · parse fails → "Replace the file with a readable copy."
Note: files in the demo are fictional, so fixtures must be **generated** (see T1.6b). `@permit/files` is now a thin TS client: cheap checks (extension, duplicate hash, filename) run in-browser; everything else delegates to the vision service.

### 2.8 Vision service API
```
POST /review   multipart: files[], submission (JSON, application fields + project_type)
  → { documents: [{filename, document_type, pages, shown_details[], confidence}], findings: Finding[], timings }
GET  /health
```
Deterministic mode (`VLM_PROVIDER=none`) is what CI runs; VLM mode is the demo upgrade. Both must pass the golden tests.

---

## 3. Golden expectations (the acceptance test — Codex-C encodes verbatim)

| Scenario | ID | Type | Readiness | Expected feedback (exact messages) |
|---|---|---|---|---|
| 1 Basement | MOCK-RES-001 | basement_renovation | Action required | Bedroom window dims; ceiling height; furnace location; existing overhead beam (4) |
| 2 Deck | MOCK-RES-002 | deck_porch (0.9 m → permit req.) | Action required | signature; rear+side property-line distances; shed missing; beam size; joist size/spacing; deck height + guard height (InfoPkg §9: missing_item_count = 8) |
| 3 Garage | MOCK-RES-003 | detached_garage | Action required | side property line distance; existing shed; foundation/slab detail (doc Missing); garage height on one elevation (4) |
| 4 Addition | MOCK-RES-004 | residential_addition | Action required | existing vs proposed not differentiated; one elevation missing; window sizes; roof connection detail; description omits wall removal (5) |
| 5 Solar | MOCK-MISC-001 | solar_panels (18 m² → req.) | Action required | PE structural review; roof-member sizes/spacing; fastener sizes/spacing; support locations; rail/support info; strengthening requirement (6) |
| 6 Café | MOCK-ICI-001 | ici_interior_alteration | Action required (flag change-of-use as staff guidance note) | key plan; code matrix; electrical plan; arch plan signature+date; plumbing professional ID; previous vs proposed use unclear (6) |
| 7 Control | MOCK-CONTROL-001 | deck_porch (0.75 m) | **Appears ready to submit** | zero issues + disclaimer |

The full "Expected feedback" sentences from InfoPkg §6–7 go into `data/copy/messages.json` keyed by detail id and the golden tests assert **exact string equality**. Decision on Scenario 6: readiness = `action_required` (matches doc); "previous use unclear" is emitted as an issue with `staffGuidance:true` tag rather than changing the top-level result.

Items in scenarios that the generic §5 rules don't cover (e.g. "description doesn't mention wall removal", "previous use unclear") are modelled as detail requirements on the Project Description (`addition.description.mentions_demolition`, `ici.description.previous_and_proposed_use`).

---

## 4. Agent roster & ownership

> Authoritative ownership + per-agent tasks: `AGENTS.md` and `agents/*.md` (these supersede task assignments below). Claude is Lead/Integrator and owns scaffold, `packages/schema`, contracts and CI.

Rule: **one owner per directory**; others open PRs against it only via the owner's interfaces. Every agent works on its own branch `agent/<name>/<task>` and opens a PR into `main`; integration lead merges.

| Agent | Role | Owns | Why this agent |
|---|---|---|---|
| **Codex-A** "Engine" | Integration lead + core logic | repo scaffold, `packages/schema`, `packages/engine`, `data/requirements`, `docs/CONTRACTS.md` | Pure TS logic, strict types |
| **Codex-B** "Vision" | CV/OCR/VLM review service | `services/vision` | Heaviest technical piece; Python + OpenCV |
| **Codex-C** "Data, Fixtures & QA" | Scenario data, **synthetic drawing generator**, tests, CI | `data/scenarios`, `data/file-cases`, `data/resources.json`, `fixtures/drawings`, `tests/*`, `.github/workflows` | Verifies everyone's work against the spec |
| **Kiro-1** "UI" | Web app flows | `apps/web` (pages, components, state) | Kiro's spec-driven flow suits multi-screen UX |
| **Kiro-2** "Content, AI & Files client" | Plain language, resources, `packages/ai`, `packages/files`, a11y, demo | `data/copy`, `data/resources.json`, `apps/web/content`, `packages/ai`, `packages/files`, `docs/DEMO.md`, README | Requirements/spec writing strength |

---

## 5. Task breakdown (phased; each task = one PR)

### Phase 0 — Foundation (Codex-A alone, blocks everyone, ~2h)
- **T0.1** Scaffold monorepo (pnpm, tsconfig strict, eslint, prettier, vitest root config, `pnpm -r test`, `pnpm -r typecheck`).
- **T0.2** `packages/schema`: all Zod schemas from §2; export types. Include `Submission` parser that accepts the InfoPkg §9 JSON verbatim (map `complete/issues` to optional legacy fields).
- **T0.3** Write `AGENTS.md` and `.kiro/steering/{product,tech,structure}.md` (contents = §0, §1, §2, §4 rules of this plan). Copy source docs into `docs/source/`.
- **T0.4** Stub `@permit/engine`, `@permit/files`, `@permit/ai` exports returning `throw new Error("not implemented")` so downstream can import.
- Exit: `pnpm install && pnpm -r typecheck` green on `main`.

### Phase 1 — Parallel build (all 5 agents)
**Codex-A**
- T1.1 `data/requirements/*.json` for all 7 sections (§5.1 general + 5.2–5.7), with detail ids matching §3 messages.
- T1.2 `classify()` — decision tree: category (home vs business) → work type → triggers (deck height ≥ 0.61 m or roof; solar mounted & ≥5 m²) → reasons[]. Unknown answers → `null` → more_info_required.
- T1.3 `buildChecklist()` and `evaluate()` per §2.5. Unit tests per rule (edge: deck exactly 0.61 m → required; 0.60 → not; solar 4.99 → not).

**Codex-B**
- T1.4a Vision service skeleton: FastAPI, Dockerfile (opencv-python-headless, paddleocr, tesseract-ocr, pymupdf), `/health`, `/review` returning contract-shaped stub.
- T1.4b `ingest.py` + FILE-001..008 rules (format, encryption, unreadable, unclear name, duplicate, combined via layout+classifier, signature via sig-field / ink-density in title-block signature box, address mismatch via parsed address vs application).
- T1.4c Detectors: title block, OCR spans, dimension parser (metric + imperial), label matcher (fuzzy: "furnace", "F.A.F.", "beam", "guard", "joist @ 16\" o.c."), linestyle (existing dashed/hatched vs proposed solid), stamp/seal.
- T1.4d `checks/<project_type>.py`: map evidence → `shown_details` ids for every detail in `data/requirements` (read the JSON, never hardcode lists).
- T1.4e `consistency.py`: address, dimensions (form vs plan), heights (form vs side view), description vs drawings (e.g. wall removal), use change (ICI).
- T1.4f `vlm.py`: page image + detail checklist → strict JSON (validated by pydantic); fuse with rules; conf < 0.6 → "unclear".
- T1.4g `@permit/files` TS client: in-browser cheap checks + call `/review`.
- Metrics script `services/vision/eval.py`: precision/recall per detail over fixtures; target recall ≥ 0.95 on golden fixtures, **0 false positives on control**.
- T1.5 `@permit/ai`: `explain(report)` and `classifyFreeText(text)` interfaces; Anthropic implementation behind `ANTHROPIC_API_KEY`; deterministic fallback (keyword classifier + messages.json). Server route only (`apps/web/app/api/ai/*` handler exported from package, mounted by Kiro-1). Prompt must forbid approval language and inventing requirements; output is re-validated with Zod; on any failure → fallback.

**Codex-C**
- T1.6 Encode scenarios 1–7 as `data/scenarios/*.json` (Submission shape; `shown_details` from "Information shown", omitting the "deliberately missing" items) + `expected` block (readiness, messages[], count).
- T1.6b **Synthetic drawing generator** `fixtures/generate.py` (reportlab + PIL): for each scenario produce the listed files (e.g. `Deck_Plan.pdf`, `Deck_Side_View.pdf`) as simple but realistic drawings — title block, labelled rooms/elements, dimension lines, notes — containing exactly the "Information shown" items and omitting the "deliberately missing" ones. Variants: vector PDF, scanned (rasterized + noise + 2° skew) PNG/PDF, imperial units. Plus FILE-001..008 fixtures (DOCX, encrypted PDF via pikepdf, `scan0004.pdf`, duplicate, unsigned arch plan, wrong address, combined, corrupted bytes) and an inconsistency set (form height ≠ drawing height). Each fixture ships a `*.truth.json` with expected detail ids + bboxes for eval.
- T1.7 `data/file-cases/file-cases.json`; `data/resources.json` (10 City links from InfoPkg "Public resources": building permits, apply, residential, ICI, miscellaneous, applications & forms, fees, standard details & guides, industry updates, online services portal — verify URLs on kitchener.ca).
- T1.8 `tests/golden`: for every scenario, `evaluate()` output equals expected (readiness, exact message set, count, `formal_approval===false`, disclaimer present). File-case tests against `validateFiles`. These will be red until engine lands — that's intended.
- T1.9 GitHub Actions: install, typecheck, lint, unit, golden, build.

**Kiro-1** (spec: `.kiro/specs/web-app/{requirements,design,tasks}.md`)
- T1.10 App shell, layout, header with "Prototype — synthetic data" badge, persistent disclaimer footer.
- T1.11 Routes: `/` landing (choose: "Start new project" / "Load demo scenario"); `/classify` stepper questionnaire; `/checklist` (grouped by document, each item: plain-language text, why, link); `/check` readiness form (application info fields, document upload/declare, per-document detail checkboxes "My drawing shows…"); `/results` (readiness banner, findings grouped by Missing/Incomplete/Unclear/Inconsistent/Wrong, each with a **document viewer** (pdf.js canvas) highlighting the evidence bbox, side-by-side for inconsistencies, "Reference" panel with requirement + InfoPkg section + City link + how to fix, and "This is wrong — I've included it" override that marks it user-confirmed); `/summary` (print CSS + "Download JSON"); `/staff` (optional: same report in compact reviewer view).
- T1.12 State in a `useSubmission` store (zustand) persisted to localStorage; demo loader imports `data/scenarios`.
- Until engine lands, use the contract types with mocked results.

**Kiro-2** (spec: `.kiro/specs/content/...`)
- T1.13 `data/copy/messages.json`: every detail id → `{missingMessage, plainLanguage, whereToAdd}`; scenario messages copied **verbatim** from InfoPkg §6–8. Grade-8 reading level for explanations; glossary (guard, joist, beam, key plan, code matrix, elevation, site plan).
- T1.14 Questionnaire copy (questions, help text, illustrations description).
- T1.15 Accessibility spec: WCAG 2.1 AA, keyboard nav, status not by colour alone (icon + text), `aria-live` on results.
- T1.16 README, `docs/DEMO.md` (3-minute demo script: deck scenario → fix items → control passes), pitch outline mapping to "What Success Looks Like".

### Phase 2 — Integration (~Codex-A leads)
- T2.1 Wire UI to real engine/files/ai (Kiro-1, reviewed by Codex-A).
- T2.2 Codex-C: Playwright E2E — load each demo scenario → results page shows expected readiness + messages; control shows "Appears ready to submit"; upload FILE fixtures → messages; disclaimer visible on results & summary.
- T2.3 Kiro-2: a11y audit (axe via Playwright), copy review against no-approval-language list (`approved`, `compliant`, `guaranteed` must not appear outside the disclaimer — enforced by a test from Codex-C).
- T2.4 Codex-B: AI-on vs AI-off parity check — same readiness & issue ids either way.

### Phase 3 — Polish & demo
Mobile layout, print summary, staff view, deploy, record demo, freeze.

### Dependency graph
```
T0.* ─┬─► T1.1–1.3 (A) ─┐
      ├─► T1.4–1.5 (B) ─┤
      ├─► T1.6–1.9 (C) ─┼─► T2.* ─► Phase 3
      ├─► T1.10–12 (K1)─┤
      └─► T1.13–16 (K2)─┘   (K2 messages.json needed by A's T1.3 — A uses ids; text resolved at runtime)
```

---

## 6. Working rules for every agent (put in AGENTS.md / steering)
1. Read `docs/PLAN.md` + `docs/CONTRACTS.md` before coding. Contracts change only via PR by Codex-A with a note to all.
2. Stay inside owned directories. Need a change elsewhere → open an issue tagged with the owner.
3. No real personal data, no real addresses, no scraping of the City portal.
4. Never output "approved/compliant/complete application" as a determination; always attach disclaimer to results.
5. Engine must stay pure (no fetch, no Date.now() in logic, no randomness).
6. Every PR: `pnpm -r typecheck && pnpm -r test` green; include tests; ≤ ~500 lines where possible.
7. Commit messages: `<area>: <imperative summary>` (e.g. `engine: add deck permit trigger`).
8. When a spec item is ambiguous, follow §3 golden table; if still ambiguous, choose the conservative option (flag an issue rather than hide one) **except** never produce a false positive on MOCK-CONTROL-001.

---

## 7. Verification (definition of done)
- `pnpm -r typecheck && pnpm -r lint && pnpm -r test` green in CI.
- Golden: 7/7 scenarios exact match; 8/8 file cases exact message; control has 0 issues.
- Engine edge tests: thresholds 0.61 m / 5 m²; unknown type → More information required; unusual flag → Staff guidance recommended.
- E2E (Playwright, `--trace off`): full journey classify → checklist → check → results → summary for deck scenario; disclaimer visible; axe shows no serious violations.
- App runs with no `ANTHROPIC_API_KEY` and produces identical results.
- Vision: `docker compose up vision && pytest services/vision` green; `python services/vision/eval.py` reports recall ≥ 0.95 on golden fixtures, 0 findings on MOCK-CONTROL-001 (vector and scanned variants), every finding has ≥1 evidence entry (or expected-region for missing) and a reference URL.
- E2E: upload the generated Scenario 2 deck files → results show the 8 expected findings with highlighted boxes; upload the inconsistency fixture → "inconsistent" finding with both values shown.
- Manual demo per `docs/DEMO.md` on the deployed URL.
