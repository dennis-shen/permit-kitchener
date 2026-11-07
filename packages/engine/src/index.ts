/**
 * @permit/engine — pure, synchronous rules engine. No I/O, no clock, no randomness.
 * Contract: docs/CONTRACTS.md §3.
 */
import {
  DISCLAIMER,
  PROJECT_TYPE_CATEGORY,
  READINESS_LABELS,
  type ChecklistItem,
  type ClassificationResult,
  type Condition,
  type DetailRequirement,
  type Finding,
  type ProjectType,
  type QuestionAnswer,
  type QuestionnaireAnswers,
  type ThresholdQuestion,
  type Readiness,
  type ReadinessReport,
  type ReportItem,
  type Requirement,
  type Submission,
} from "@permit/schema";
import { FALLBACK_URL, GENERAL, REQUIREMENT_SETS, resolveResources } from "./data";

export { REQUIREMENT_SETS, GENERAL, RESOURCES, resolveResources, PROJECT_OPTIONS, DOCUMENT_TYPES, DOCUMENT_LABELS } from "./data";
import { PROJECT_OPTIONS } from "./data";

type Facts = Record<string, string | number | boolean | undefined>;

// ───────────────────────── Conditions ─────────────────────────

export function evalCondition(c: Condition | undefined, facts: Facts): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every((x) => evalCondition(x, facts));
  if ("any" in c) return c.any.some((x) => evalCondition(x, facts));
  if ("not" in c) return !evalCondition(c.not, facts);
  const v = facts[c.fact];
  if (v === undefined) return false; // unknown facts never make something applicable
  if (c.eq !== undefined && v !== c.eq) return false;
  if (c.gte !== undefined && !(typeof v === "number" && v >= c.gte)) return false;
  if (c.lt !== undefined && !(typeof v === "number" && v < c.lt)) return false;
  if (c.in !== undefined && !c.in.includes(v)) return false;
  return true;
}

/** Permit trigger: true / false, or "unknown" when a needed fact is missing. */
export function permitRequired(type: ProjectType, facts: Facts): boolean | "unknown" {
  const trig = REQUIREMENT_SETS[type].permitTrigger?.requiredWhen;
  if (!trig) return true;
  if (evalCondition(trig, facts)) return true;
  const needed = collectFacts(trig);
  // deck: a roof alone makes it required, so only unknown if height is unknown and roof isn't true
  return needed.some((f) => facts[f] === undefined) ? "unknown" : false;
}

function collectFacts(c: Condition): string[] {
  if ("all" in c) return c.all.flatMap(collectFacts);
  if ("any" in c) return c.any.flatMap(collectFacts);
  if ("not" in c) return collectFacts(c.not);
  return [c.fact];
}

// ───────────────────────── classify ─────────────────────────

const WORK_TO_TYPE: Record<string, ProjectType> = {
  finish_basement: "basement_renovation",
  deck_or_porch: "deck_porch",
  garage_or_shed: "detached_garage",
  addition: "residential_addition",
  solar: "solar_panels",
  interior_alteration: "ici_interior_alteration",
};

const yn = (v: "yes" | "no" | "unsure" | undefined): boolean | undefined =>
  v === "yes" ? true : v === "no" ? false : undefined;

/** Facts usable by conditions, derived from questionnaire answers. */
export function answersToFacts(a: QuestionnaireAnswers): Facts {
  return {
    deck_height_metres: a.deckHeightMetres,
    permanent_roof: yn(a.permanentRoof),
    aggregate_panel_area_m2: a.solarAreaM2,
    mounted_to_building: yn(a.solarMountedToBuilding),
    has_kitchen_or_bathroom: yn(a.hasKitchenOrBathroom),
  };
}

export function classify(a: QuestionnaireAnswers): ClassificationResult {
  const reasons: string[] = [];
  const unusual: string[] = [];
  let type: ProjectType | null = a.workKind ? (WORK_TO_TYPE[a.workKind] ?? null) : null;

  // Interior work in a house is a basement/interior alteration; in a business unit it is ICI.
  if (a.workKind === "interior_alteration" && a.buildingKind === "house") type = "basement_renovation";
  if (a.workKind === "finish_basement" && a.buildingKind && a.buildingKind !== "house" && a.buildingKind !== "unsure")
    type = "ici_interior_alteration";

  if (!type) {
    reasons.push("We could not tell which kind of project this is from the answers given.");
    return { projectType: null, category: null, permitRequired: "unknown", reasons, unusualAspects: [] };
  }

  reasons.push(`Your answers match a ${TYPE_LABELS[type].toLowerCase()} project.`);
  const facts = answersToFacts(a);
  const req = permitRequired(type, facts);
  const trig = REQUIREMENT_SETS[type].permitTrigger;
  if (trig) {
    if (req === true) reasons.push(trig.explanation);
    else if (req === false)
      reasons.push(`A permit may not be required under the simplified rules. ${trig.explanation} Confirm with the City.`);
    else reasons.push(`We need more details to tell whether a permit is required. ${trig.explanation}`);
  }

  if (a.changeOfUse === "yes") unusual.push("Change of use");
  if (a.multiUnitOrHeritage === "yes") unusual.push("Multi-unit or heritage property");
  if (a.removesStructuralElement === "yes" && type === "basement_renovation")
    unusual.push("Removal of a structural element");
  if (a.workKind === "other") unusual.push("Project type not covered by the simplified rules");

  return {
    projectType: type,
    category: PROJECT_TYPE_CATEGORY[type],
    permitRequired: req,
    reasons,
    unusualAspects: unusual,
  };
}

export const TYPE_LABELS: Record<ProjectType, string> = {
  basement_renovation: "Basement renovation",
  deck_porch: "Deck or porch",
  detached_garage: "Detached garage or accessory structure",
  residential_addition: "Residential addition",
  solar_panels: "Rooftop solar panels",
  ici_interior_alteration: "Commercial (ICI) interior alteration",
};

// ───────────────────────── checklist ─────────────────────────

function requirementsFor(type: ProjectType): Requirement[] {
  return [...GENERAL.requirements, ...REQUIREMENT_SETS[type].requirements];
}

export function buildChecklist(type: ProjectType, attrs: Facts = {}): ChecklistItem[] {
  return requirementsFor(type)
    .filter((r) => evalCondition(r.appliesWhen, attrs))
    .map((r) => ({
      requirementId: r.id,
      label: r.label,
      plainLanguage: r.plainLanguage,
      documentType: r.documentType,
      alsoAcceptedIn: r.alsoAcceptedIn,
      details: r.details
        .filter((d) => !d.appliesWhen || evalCondition(d.appliesWhen, attrs))
        .map((d) => ({ id: d.id, label: d.label, whereToAdd: d.whereToAdd })),
      resources: resolveResources(r.resourceIds),
      links: r.links,
      infoPkgSection: r.infoPkgSection,
    }));
}

// ───────────────────────── evaluate ─────────────────────────

const APPLICATION_FIELDS: Record<string, (s: Submission) => boolean> = {
  "general.application.applicant_name": (s) => s.application.applicant_name.trim() !== "",
  "general.application.property_address": (s) => s.application.property_address.trim() !== "",
  "general.application.applicant_role": (s) => s.application.applicant_role.trim() !== "",
  "general.application.project_type": (s) => !!s.application.project_type,
  "general.application.project_description": (s) => s.application.project_description.trim() !== "",
  "general.application.estimated_construction_value": (s) => s.application.estimated_construction_value > 0,
  "general.application.submission_date": (s) => s.application.submission_date.trim() !== "",
  "general.application.declaration_completed": (s) => s.application.declaration_completed,
  "general.application.signature_present": (s) => s.application.signature_present,
};

interface Issue {
  detailId: string;
  message: string;
  whereToAdd?: string;
  staffGuidance?: boolean;
}

export function evaluate(submission: Submission, extraFindings: Finding[] = []): ReadinessReport {
  const type = submission.application.project_type;
  const facts: Facts = { ...submission.project_attributes };
  const docs = submission.documents.filter((d) => d.present);
  const items: ReportItem[] = [];
  const findings: Finding[] = [];
  let issueCount = 0;

  for (const req of requirementsFor(type)) {
    const resources = resolveResources(req.resourceIds);
    if (!evalCondition(req.appliesWhen, facts)) {
      items.push({ requirementId: req.id, label: req.label, status: "not_applicable", issues: [], resources });
      continue;
    }
    const applicable = req.details.filter((d) => !d.appliesWhen || evalCondition(d.appliesWhen, facts));
    const accepted = new Set([req.documentType, ...req.alsoAcceptedIn]);
    const isApplication = req.id === "general.application";
    const candidates = docs.filter((d) => accepted.has(d.document_type));
    const primaryPresent = docs.some((d) => d.document_type === req.documentType);
    const shown = new Set(candidates.flatMap((d) => d.shown_details));

    const issues: Issue[] = [];
    let status: ReportItem["status"];

    if (isApplication) {
      for (const d of applicable) if (!APPLICATION_FIELDS[d.id]?.(submission)) issues.push(issueOf(d));
      status = issues.length ? "incomplete" : "complete";
    } else if (!primaryPresent && !applicable.some((d) => shown.has(d.id))) {
      // Whole document absent: one issue for the document, plus details that must be reported on their own.
      status = "missing";
      issues.push({
        detailId: req.id,
        message: req.missingMessage,
        whereToAdd: `Upload the ${req.label.toLowerCase()}. It should show: ${applicable.map((d) => d.label.toLowerCase()).join("; ")}.`,
      });
      for (const d of applicable) if (d.reportWhenDocumentMissing) issues.push(issueOf(d));
    } else {
      for (const d of applicable) if (!shown.has(d.id)) issues.push(issueOf(d));
      status = issues.length ? "incomplete" : "complete";
    }

    issueCount += issues.length;
    items.push({ requirementId: req.id, label: req.label, status, issues, resources });

    const doc = candidates.find((d) => d.document_type === req.documentType) ?? candidates[0];
    for (const iss of issues) {
      findings.push({
        id: `eng:${iss.detailId}`,
        category: status === "missing" ? "missing" : "incomplete",
        severity: iss.staffGuidance ? "warning" : "blocker",
        requirementId: req.id,
        detailId: iss.detailId,
        message: iss.message,
        evidence:
          doc && !isApplication
            ? [{ filename: doc.filename, page: 1, expectedRegion: true, confidence: 1, source: "rule" }]
            : [],
        reference: {
          requirementLabel: req.label,
          infoPkgSection: req.infoPkgSection,
          cityUrl: resources[0]?.url ?? FALLBACK_URL,
          howToFix: iss.message,
          whereToAdd: iss.whereToAdd,
          links: req.links,
        },
        staffGuidance: iss.staffGuidance,
      });
    }
  }

  const active = extraFindings.filter((f) => !f.userOverridden);
  // Drop engine findings the user has explicitly overridden.
  const overridden = new Set(extraFindings.filter((f) => f.userOverridden).map((f) => f.id));
  const engineFindings = findings.filter((f) => !overridden.has(f.id));
  const allFindings = dedupeFindings([...engineFindings, ...active]);
  const outstanding = engineFindings.length + active.length;

  const readiness: Readiness = submission.flags.unusual_aspects.length
    ? "staff_guidance_recommended"
    : outstanding > 0
      ? "action_required"
      : "appears_ready";

  return {
    application_id: submission.application.application_id,
    project_type: type,
    permit_required: permitRequired(type, facts),
    readiness,
    readiness_label: READINESS_LABELS[readiness],
    items,
    findings: allFindings,
    missing_item_count: issueCount - overridden.size,
    formal_approval: false,
    disclaimer: DISCLAIMER,
  };
}

function issueOf(d: DetailRequirement): Issue {
  return { detailId: d.id, message: d.missingMessage, whereToAdd: d.whereToAdd, staffGuidance: d.staffGuidance };
}

/** Look-ups by id across every requirement set (for summaries and the PDF). */
export const REQUIREMENT_INDEX: Record<string, Requirement> = Object.fromEntries(
  [GENERAL, ...Object.values(REQUIREMENT_SETS)].flatMap((s) => s.requirements.map((r) => [r.id, r])),
);
export const DETAIL_INDEX: Record<string, DetailRequirement> = Object.fromEntries(
  Object.values(REQUIREMENT_INDEX).flatMap((r) => r.details.map((d) => [d.id, d])),
);

// ───────────────────────── threshold questions ─────────────────────────

/** Questions to ask before uploads: general questions plus the project type's own (data/requirements/*.json). */
export function questionsFor(type: ProjectType): ThresholdQuestion[] {
  return [...REQUIREMENT_SETS[type].questions, ...GENERAL.questions];
}

/** Turn answers (keyed by question id) into facts for conditions. "unsure" and blanks stay unknown. */
export function factsFromAnswers(type: ProjectType, answers: Record<string, QuestionAnswer | undefined>): Facts {
  const facts: Facts = {};
  for (const q of questionsFor(type)) {
    const a = answers[q.id];
    if (a === undefined || a === "unsure") continue;
    facts[q.fact] = q.kind === "number" ? (typeof a === "number" ? a : undefined) : a === "yes";
  }
  return facts;
}

/** Unusual aspects (→ staff guidance recommended) from "yes" answers. */
export function unusualFromAnswers(type: ProjectType, answers: Record<string, QuestionAnswer | undefined>): string[] {
  return questionsFor(type).flatMap((q) => (q.unusualIfYes && answers[q.id] === "yes" ? [q.unusualIfYes] : []));
}

export function allQuestionsAnswered(type: ProjectType, answers: Record<string, QuestionAnswer | undefined>): boolean {
  return questionsFor(type).every((q) => answers[q.id] !== undefined);
}

/** Explanation of the permit trigger for a project type, if it has one. */
export function permitExplanation(type: ProjectType): string | undefined {
  return REQUIREMENT_SETS[type].permitTrigger?.explanation;
}

// ───────────────────────── project search (dropdown) ─────────────────────────

/** Rank project options for what the applicant typed (label, description and keywords). */
export function searchProjects(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return PROJECT_OPTIONS;
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  const scored = PROJECT_OPTIONS.map((o) => {
    const hay = [o.label, o.description, ...o.keywords].join(" ").toLowerCase();
    let score = hay.includes(q) ? 10 : 0;
    for (const k of o.keywords) if (q.includes(k.toLowerCase())) score += 5;
    for (const w of words) if (hay.includes(w)) score += 1;
    return { o, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.o);
}

function dedupeFindings(fs: Finding[]): Finding[] {
  const seen = new Set<string>();
  return fs.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}

/** Report for when the project type is unknown. */
export function unknownProjectReport(applicationId: string): ReadinessReport {
  return {
    application_id: applicationId,
    project_type: null,
    permit_required: "unknown",
    readiness: "more_info_required",
    readiness_label: READINESS_LABELS.more_info_required,
    items: [],
    findings: [],
    missing_item_count: 0,
    formal_approval: false,
    disclaimer: DISCLAIMER,
  };
}

/** Unique messages in report order (shared messages shown once). */
export function uniqueMessages(report: ReadinessReport): string[] {
  return [...new Set(report.findings.map((f) => f.message))];
}
