# CONTRACTS — frozen interfaces (tag `v0-contracts`)

Source of truth is code: `packages/schema/src/index.ts` (Zod). JSON Schema copies for Python live in `packages/schema/json/` (`pnpm schema:json` regenerates). This file explains them. **Changes only via a Lead PR titled `CONTRACT: …`.**

## 1. Vocabulary
| Thing | Values |
|---|---|
| `ProjectType` | `basement_renovation` · `deck_porch` · `detached_garage` · `residential_addition` · `solar_panels` · `ici_interior_alteration` · `hvac_system` |
| `ProjectCategory` | `Residential` · `ICI` · `Miscellaneous` (solar) — map in `PROJECT_TYPE_CATEGORY` |
| `DocumentType` | `application_form`, `project_description`, `site_plan`, `floor_plan`, `existing_floor_plan`, `proposed_floor_plan`, `foundation_plan`, `framing_plan`, `roof_plan`, `elevations`, `sections_details`, `deck_plan`, `deck_side_view`, `key_plan`, `architectural_plan`, `plumbing_plan`, `hvac_plan`, `electrical_plan`, `equipment_layout`, `code_matrix`, `structural_review`, `mounting_system_spec`, `panel_spec`, `solar_roof_plan`, `designer_schedule` (Schedule 1), `heat_loss_gain`, `other` |
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
      "whereToAdd": "Side view: dimension the guard (railing) height above the deck floor."
    }]
  }]
}
```
- Detail ids match `^[a-z_]+\.[a-z_]+\.[a-z_]+$` and are listed in `data/requirements/INDEX.md`.
- `Condition`: `{fact, eq|gte|lt|in}` evaluated against facts (answers + project attributes), combinable with `all` / `any` / `not`. Unknown facts never make something applicable.
- `questions[].kind`: `yes_no` (answers `yes` / `no` / `unsure` → `true` / `false` / unknown) or `number`. `unusualIfYes` adds an unusual aspect (→ Staff guidance recommended).
- Application-form fields (`general.application.*`) are checked from the uploaded form PDF like any other document. The typed application details never satisfy them.
- `optional: true` on a detail: a field filled in only where it applies (unit number, fax, firm BCIN…). It is listed on its page but never reported as missing, and never blocks the page.
- `reportWhenDocumentMissing: true` on a detail reports it separately even when its whole document is missing.
- `infoPkgSection` names the source: an InfoPkg section (`§5.3`) or, for types not in the InfoPkg, the City page (`hvac_system.json`: "City: Changing an HVAC system").
- `general.json` (§5.1) applies to every project type. Its application-form requirement is checked from the application details, and the form PDF itself must also be uploaded.
- **One PDF per page**: requirements sharing a `documentType` are shown and checked together as one page (`documentPages()`), in the order they appear in the JSON. A requirement is never satisfied by a different document type.

### Other configuration
- `data/project-types.json`: `{ projectTypes: [{type, label, description, keywords[]}] }`, the project dropdown and search.
- `data/document-types.json`: `{ documentTypes: [{type, label}] }`.

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

## 4. Files client — `@permit/files`
```ts
precheckFiles(files: UploadFile[]): Promise<Finding[]>             // in browser: format, size, duplicate hash/name, vague name
listSaved(): Promise<SessionFiles>;  saveFile(page, file, req: ReviewRequest): Promise<SessionFiles>
removeSaved(page): Promise<SessionFiles>;  clearSaved(): Promise<SessionFiles>      // throw on failure
```
Web routes `/api/files` (GET list, DELETE all) and `/api/files/<page>` (PUT multipart `file` + `submission`, DELETE) proxy to the review service's `/sessions/{sid}/files…` (`REVIEW_URL`, default `http://localhost:8000`), with the session id from an httpOnly cookie. Each returns `SessionFiles` `{files: [{page, file: StoredFile{id, name, type, size, uploaded_at}, review: ReviewResponse}]}`. The browser merges `review.documents[].shown_details` into `Submission.documents` and runs `evaluate` (`apps/web/lib/review.ts`).

## 5. Review service — `services/review` (uv app)
```
GET  /health  → {"ok": true}
PUT  /sessions/{sid}/files/{page}  multipart: file, submission → SessionFiles (also GET /sessions/{sid}/files, DELETE …/{page}, DELETE /sessions/{sid})
POST /review  (no saving) multipart: files[] (≤30, ≤20 MB each), submission = JSON ReviewRequest {application, project_attributes, document_hints{filename → DocumentType}}
           → ReviewResponse {documents:[{filename, document_type, shown_details[], detail_evidence{detailId|near:detailId → Evidence}}],
              findings: Finding[], inferred_attributes{}}
```
`document_hints` name the page each file was uploaded on. Today the service runs file checks only (name and bytes) and returns empty `shown_details`; the custom review API will fill them (`src/permit_review/review.py`).

**Finding** example:
```json
{ "id": "f-deck-side-guard", "category": "incomplete", "severity": "blocker",
  "requirementId": "deck.side_view", "detailId": "deck.side_view.guard_height",
  "message": "The side view is incomplete. Add the deck height and guard height.",
  "evidence": [{ "filename": "Deck_Side_View.pdf", "page": 1, "expectedRegion": true, "confidence": 1, "source": "rule" }],
  "reference": { "requirementLabel": "Side view showing deck and guard height", "infoPkgSection": "§5.3",
    "cityUrl": "https://www.kitchener.ca/…", "howToFix": "Add the deck height and guard height to the side view." } }
```
- `bbox` (optional) is in PDF points, origin top-left, `[x0,y0,x1,y1]`. `expectedRegion: true` means "where it should be".
- `inconsistent` findings fill `conflictsWith` with the other side's evidence (both carry `value`).
- File checks use `fileCode` plus the exact `FILE_FINDING_MESSAGES` text.
