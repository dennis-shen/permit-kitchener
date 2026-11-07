# Brief: Codex-A — Rules Engine & Requirements Data

You turn the City's (simplified) requirements into data and write the pure logic that decides what applies and what's missing.

## Owns
`packages/engine/`, `data/requirements/`.

## Read first
`AGENTS.md`, `docs/CONTRACTS.md`, `docs/PLAN.md §2–3`, InfoPkg §5 (requirements) and §6–7 (scenarios) in `docs/source/Info_Package.docx` (extract text with `unzip -p file word/document.xml | sed -e 's/<\/w:p>/\n/g; s/<[^>]*>//g'`).

## Domain rules you must encode (InfoPkg §5)
- **§5.1 General (every project):** applicant name, property address, applicant role, project type, project description, estimated construction value, application date, applicant declaration, applicant signature.
- **§5.2 Basement renovation:** application info; project description; basement floor plan with room names; window & door sizes; kitchen/bathroom layout *(only when applicable)*; stairs location; furnace location; new wall construction; existing ducting/overhead beams; ceiling height.
- **§5.3 Deck/porch:** permit required if height ≥ 0.61 m (24") at any point **or** permanent roof. Needs: application info; site plan; deck dimensions; distance to property lines; nearby structures (shed, pool); plan view (posts, floor joists size+spacing, beams, stairs, landings); side view (deck height, guard height).
- **§5.4 Detached garage/accessory:** application info; description; structure dimensions; site plan; distance to property lines; other structures; construction drawings; foundation/slab info; elevations (incl. height on each).
- **§5.5 Residential addition:** application info; description (incl. any demolition e.g. removal of exterior wall); site plan; floor plans; foundation plan; framing; roof plan (incl. existing/new roof connection); elevations (all affected sides); sections & details; window sizes; clear existing vs proposed distinction.
- **§5.6 Solar:** permit required if mounted to building **and** aggregate area ≥ 5 m². Needs: application info; panel location plan; existing structural system description (roof member sizes/spacing); PE review of roof structure; mounting details; fastener sizes & spacing; rail & support info + support locations; strengthening details if required (and a statement whether required); mounting-system specs; panel manufacturer specs.
- **§5.7 ICI interior alteration:** application form; description (previous **and** proposed use); code matrix; professional/designer info; key plan; architectural, plumbing, HVAC, electrical plans; professional stamps, signatures and dates on each.

## Tasks
**A1 — `data/requirements/<type>.json`** (7 files: `general.json` + one per ProjectType). Each `Requirement` has stable ids `"<type>.<doc>.<detail>"` e.g. `deck.side_view.guard_height`. Every detail needed to produce each expected-feedback line in `docs/PLAN.md §3` must exist (e.g. `basement.floor_plan.window_sizes`, `basement.floor_plan.furnace_location`, `basement.floor_plan.overhead_beam`, `basement.floor_plan.ceiling_height`, `addition.description.mentions_demolition`, `ici.description.previous_and_proposed_use`, `ici.architectural_plan.signature_date`, `ici.plumbing_plan.professional_id`). Add `infoPkgSection`, `resourceIds`, and `visionHints` (keywords/synonyms the vision service will look for, e.g. furnace: `["furnace","FAF","F.A.F.","mech room"]`). Add a Zod validation test that loads every file.
Publish an id list in `data/requirements/INDEX.md` — Codex-B, Codex-C and Kiro-2 key off these ids. **Do this first (within your first PR)**.

**A2 — `classify(answers)`.** Decision tree from `QuestionnaireAnswers` (who: homeowner/business; building: house/commercial unit; work: finish basement / deck or porch / garage or shed / addition / solar / interior alteration; attributes: height, roof, area, mounted). Return `{projectType|null, category, permitRequired: true|false|"unknown", reasons[]}`. Unknown → `null` (→ More information required). Unusual signals (multi-unit, change of use, heritage, structural removal in basement) → add to `flags.unusual_aspects`.

**A3 — `buildChecklist(type, attrs)`** → general + type requirements filtered by `appliesWhen`, ordered by document, with resources resolved.

**A4 — `evaluate(submission, findings?)`** exactly per `docs/PLAN.md §2.5`:
- item status: not_applicable / missing (no doc of that type) / incomplete (applicable detail not in `shown_details`, or a vision finding targets it) / complete;
- merges vision `Finding[]` (inconsistent/unclear/wrong) — these force `action_required`;
- readiness precedence: more_info → staff_guidance → action_required → appears_ready. ICI "previous use unclear" stays `action_required` with `staffGuidance:true` on the finding;
- `missing_item_count`, `formal_approval:false`, `DISCLAIMER`;
- messages resolved from `data/copy/messages.json` by detail id (Kiro-2 owns text; fallback to `DetailRequirement.missingMessage`).
Pure: no I/O, no Date, no randomness. Deterministic ordering.

**A5 — Unit tests** (Vitest): thresholds (deck 0.61 → required, 0.60 → not, roof → required; solar 5.0 → required, 4.99 → not, ground-mounted → not), not_applicable kitchen/bath, unknown type, unusual flag, finding merge, control scenario returns zero issues. Run Codex-C's golden suite locally before each PR.

## Done when
Golden suite (`tests/golden`) passes 7/7 for engine-only mode (`shown_details` from scenario JSON). Coverage ≥ 90 % on `packages/engine`.
