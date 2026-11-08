# CONTRACTS — frozen interfaces (tag `v0-contracts`)

Source of truth is code: `packages/schema/src/index.ts` (Zod). JSON Schema copies for Python live in `packages/schema/json/` (`pnpm schema:json` regenerates). This file explains them. **Changes only via a Lead PR titled `CONTRACT: …`.**

## 1. Vocabulary
| Thing | Values |
|---|---|
| `ProjectType` | `basement_renovation` · `deck_porch` · `detached_garage` · `residential_addition` · `solar_panels` · `ici_interior_alteration` |
| `ProjectCategory` | `Residential` · `ICI` · `Miscellaneous` (solar) — map in `PROJECT_TYPE_CATEGORY` |
| `DocumentType` | `application_form`, `project_description`, `site_plan`, `floor_plan`, `existing_floor_plan`, `proposed_floor_plan`, `foundation_plan`, `framing_plan`, `roof_plan`, `elevations`, `sections_details`, `deck_plan`, `deck_side_view`, `key_plan`, `architectural_plan`, `plumbing_plan`, `hvac_plan`, `electrical_plan`, `equipment_layout`, `code_matrix`, `structural_review`, `mounting_system_spec`, `panel_spec`, `solar_roof_plan`, `other` |
| `ItemStatus` | `complete` · `incomplete` · `missing` · `not_applicable` (labels in `ITEM_STATUS_LABELS`) |
| `Readiness` | `appears_ready` · `action_required` · `more_info_required` · `staff_guidance_recommended` (labels in `READINESS_LABELS`: "Appears ready to submit", "Application incomplete", "More information required", "Staff guidance recommended") |
| `FindingCategory` | `missing` · `incomplete` · `unclear` · `inconsistent` · `wrong` |
| `Severity` | `blocker` · `warning` · `info` |
| `FileFindingCode` | FILE-001 `WRONG_FORMAT` … FILE-008 `UNREADABLE`; exact messages in `FILE_FINDING_MESSAGES` |
| Constants | `DISCLAIMER` (verbatim), `FORBIDDEN_PHRASES` |

## 2. Requirement data (`data/requirements/<projectType|general>.json` → `RequirementSet`)
```jsonc
{
  "projectType": "deck_porch", "infoPkgSection": "§5.3",
  "permitTrigger": { "projectType": "deck_porch",
    "requiredWhen": { "any": [ { "fact": "deck_height_metres", "gte": 0.61 }, { "fact": "permanent_roof", "eq": true } ] },
    "explanation": "A permit is treated as required at a height of at least 0.61 m (24 in) at any point or with a permanent roof." },
  "questions": [   // asked before uploads; answers become facts
    { "id": "deck_height_metres", "fact": "deck_height_metres", "kind": "number", "unit": "metres", "text": "How high will the deck be…?" },
    { "id": "permanent_roof", "fact": "permanent_roof", "kind": "yes_no", "text": "Will the deck or porch have a permanent roof?" }
  ],
  "requirements": [{
    "id": "deck.side_view", "label": "Deck side view", "documentType": "deck_side_view",   // the one PDF it is checked on
    "plainLanguage": "A drawing of the deck from the side…", "missingMessage": "Add deck side view.",
    "infoPkgSection": "§5.3", "resourceIds": ["residential-permits"],
    "links": [ { "label": "Residential building permits", "url": "https://www.kitchener.ca/…", "kind": "guide" } ],
    "details": [{
      "id": "deck.side_view.guard_height", "label": "Guard height",
      "missingMessage": "The side view is incomplete. Add the deck height and guard height.",
      "whereToAdd": "Side view: dimension the guard (railing) height above the deck floor.",
      "vision": { "check": "text", "patterns": ["guard (ht|height)?…"], "hints": ["guard", "railing"] }
    }]
  }]
}
```
- Detail ids match `^[a-z_]+\.[a-z_]+\.[a-z_]+$` and are listed in `data/requirements/INDEX.md`.
- `Condition`: `{fact, eq|gte|lt|in}` evaluated against facts (answers + project attributes), combinable with `all` / `any` / `not`. Unknown facts never make something applicable.
- `questions[].kind`: `yes_no` (answers `yes` / `no` / `unsure` → `true` / `false` / unknown) or `number`. `unusualIfYes` adds an unusual aspect (→ Staff guidance recommended).
- `vision.check`: `text` (regex `patterns`, else fuzzy `hints`), `stamp`, `signature_and_date`, `every_elevation_has_height`, `form_field` (named `formField`, from the Ontario form), or `none`. New kinds are registered in `services/vision/app/checks.py`.
- `reportWhenDocumentMissing: true` on a detail reports it separately even when its whole document is missing.
- `general.json` (§5.1) applies to every project type. Its application-form requirement is checked from the application details, and the form PDF itself must also be uploaded.
- **One PDF per page**: requirements sharing a `documentType` are shown and checked together as one page (`documentPages()`), in the order they appear in the JSON. A requirement is never satisfied by a different document type.

### Other configuration
- `data/project-types.json`: `{ projectTypes: [{type, label, description, keywords[]}] }`, the project dropdown and search.
- `data/vision/document-types.json`: `{ filenameRules: [{pattern, type}], titleRules: [{pattern, type}], documentTypes: [{type, label, professionalDrawing, form?}] }`.
- `data/vision/forms/*.json`: form field maps `{ id, title, source, documentType, extraction, sections: [{id, title, fields: [{id, labels[], fillableField?, kind, required, mapsTo?}]}] }`.

## 3. Engine — `@permit/engine` (Codex-A). Pure and synchronous.
```ts
classify(answers: QuestionnaireAnswers): ClassificationResult
buildChecklist(type: ProjectType, attrs?: Record<string, number|boolean|string>): ChecklistItem[]   // items carry links + details[].whereToAdd
evaluate(submission: Submission, findings?: Finding[]): ReadinessReport       // findings' reference carries whereToAdd + links
questionsFor(type): ThresholdQuestion[]                                        // project questions + general questions
factsFromAnswers(type, answers): Facts;  unusualFromAnswers(type, answers): string[];  allQuestionsAnswered(type, answers): boolean
permitRequired(type, facts): boolean | "unknown";  searchProjects(query): ProjectOption[]
documentPages(type, facts): { documentType, label, items: ChecklistItem[] }[]   // one page per PDF, data order
```
**Submission** = `{ application: ApplicationInfo, project_attributes, documents: [{filename, document_type, present, shown_details[]}], flags: {unusual_aspects[]} }`. `parseInfoPkgJson()` turns the InfoPkg §9 sample into one. The engine never trusts the legacy `complete`/`issues` fields.

**evaluate rules**
- Item `not_applicable` if `appliesWhen` is false → `missing` if no document of its `documentType` was uploaded → `incomplete` if any applicable detail is not in that document's `shown_details` → else `complete`.
- Application-info details (signature, declaration…) are checked from `application` fields.
- Readiness: project type unknown → `more_info_required`; else `flags.unusual_aspects` non-empty → `staff_guidance_recommended`; else any incomplete/missing item or any non-overridden finding → `action_required`; else `appears_ready`.
- Output carries `readiness_label`, `findings` (engine-generated + passed-in), `missing_item_count` (number of issues), `formal_approval: false`, `disclaimer: DISCLAIMER`. Zod rejects anything else.

Example output (shortened):
```json
{ "application_id": "MOCK-RES-002", "project_type": "deck_porch", "permit_required": true,
  "readiness": "action_required", "readiness_label": "Application incomplete",
  "items": [{ "requirementId": "deck.side_view", "label": "Side view", "status": "incomplete",
    "issues": [{ "detailId": "deck.side_view.guard_height", "message": "The side view is incomplete. Add the deck height and guard height." }],
    "resources": [] }],
  "findings": [], "missing_item_count": 8, "formal_approval": false, "disclaimer": "The result is preliminary guidance only. …" }
```

## 4. Files client — `@permit/files` (Kiro-2)
```ts
precheckFiles(files: UploadFile[]): Promise<Finding[]>             // in browser: format, size, duplicate hash/name, vague name
reviewFiles(files: UploadFile[], req: VisionReviewRequest): Promise<ReviewResult>
// ReviewResult = {visionUnavailable:false, ...VisionReviewResponse} | {visionUnavailable:true, findings}
```
Web route `POST /api/vision` proxies to the vision service; the browser then runs `evaluate` (see `apps/web/lib/merge.ts`). Originally specified as `POST /api/review` (Kiro-1 builds, Lead reviews): multipart → vision `POST /review` → merge `documents[].shown_details` into `Submission.documents` → `evaluate(submission, findings)` → `ReadinessReport` plus `documents` for the viewer.

## 5. Vision service — `services/vision` (Codex-B)
```
GET  /health  → {"ok": true, "ocr_engine": "tesseract", "vlm_provider": "none"}
POST /review  multipart: files[] (≤30, ≤20 MB each), submission = JSON VisionReviewRequest {application, project_attributes, document_hints{filename → DocumentType}}
           → VisionReviewResponse {documents:[{filename, document_type, pages, shown_details[], confidence, detail_evidence{detailId|near:detailId → Evidence}, previews[{page,width,height,png_base64}]}],
              findings: Finding[], timings, vlm_used, inferred_attributes{}, form_fields{signature_present?, declaration_completed?}}
```
`document_hints` come from the upload slot a file was placed in and override auto-classification.
Env: `VLM_PROVIDER` (`none`|`anthropic`|`local`), `ANTHROPIC_API_KEY`, `OCR_ENGINE` (`tesseract`|`paddle`), `REQUIREMENTS_DIR`, `RESOURCES_FILE`.

**Finding** (every one carries a reference):
```json
{ "id": "f-deck-side-guard", "category": "incomplete", "severity": "blocker",
  "requirementId": "deck.side_view", "detailId": "deck.side_view.guard_height",
  "message": "The side view is incomplete. Add the deck height and guard height.",
  "evidence": [{ "filename": "Deck_Side_View.pdf", "page": 1, "bbox": [72, 300, 420, 520], "expectedRegion": true, "confidence": 0.9, "source": "rule" }],
  "reference": { "requirementLabel": "Side view showing deck and guard height", "infoPkgSection": "§5.3",
    "cityUrl": "https://www.kitchener.ca/…", "howToFix": "Add the deck height and guard height to the side view." } }
```
- `bbox` is in PDF points, origin top-left, `[x0,y0,x1,y1]`. `expectedRegion: true` means "where it should be", not where it was found.
- `inconsistent` findings fill `conflictsWith` with the other side's evidence (both carry `value`).
- File checks use `fileCode` plus the exact `FILE_FINDING_MESSAGES` text.

## 6. AI — `@permit/ai` (Kiro-2). Server only. Optional.
```ts
explain(report: ReadinessReport): Promise<Record<findingId, string>>   // plainer howToFix; never adds/removes findings
classifyFreeText(text: string): Promise<{projectType: ProjectType|null, confidence, followUpQuestions[]}>
```
With no `ANTHROPIC_API_KEY`, falls back to messages.json and a keyword classifier. Readiness and finding ids must be the same with AI on or off.
