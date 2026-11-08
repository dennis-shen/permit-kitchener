/**
 * @permit/schema — single source of truth for every shape exchanged between
 * the engine, the review service, the files client and the web app.
 * Human-readable mirror: docs/CONTRACTS.md. Change only via a `CONTRACT:` PR.
 */
import { z } from "zod";

// ───────────────────────── Constants ─────────────────────────

export const DISCLAIMER =
  "The result is preliminary guidance only. It is not confirmation that an application is complete, compliant or approved. Final requirements are determined through the City's application and review process." as const;

export const FORBIDDEN_PHRASES = [
  "approved",
  "compliant",
  "guaranteed",
  "your application is complete",
] as const;

// ───────────────────────── Enums ─────────────────────────

export const ProjectCategory = z.enum(["Residential", "ICI", "Miscellaneous"]);
export type ProjectCategory = z.infer<typeof ProjectCategory>;

export const ProjectType = z.enum([
  "basement_renovation",
  "deck_porch",
  "detached_garage",
  "residential_addition",
  "solar_panels",
  "ici_interior_alteration",
]);
export type ProjectType = z.infer<typeof ProjectType>;

export const PROJECT_TYPE_CATEGORY: Record<ProjectType, ProjectCategory> = {
  basement_renovation: "Residential",
  deck_porch: "Residential",
  detached_garage: "Residential",
  residential_addition: "Residential",
  solar_panels: "Miscellaneous",
  ici_interior_alteration: "ICI",
};

export const DocumentType = z.enum([
  "application_form",
  "project_description",
  "site_plan",
  "floor_plan",
  "existing_floor_plan",
  "proposed_floor_plan",
  "foundation_plan",
  "framing_plan",
  "roof_plan",
  "elevations",
  "sections_details",
  "deck_plan",
  "deck_side_view",
  "key_plan",
  "architectural_plan",
  "plumbing_plan",
  "hvac_plan",
  "electrical_plan",
  "equipment_layout",
  "code_matrix",
  "structural_review",
  "mounting_system_spec",
  "panel_spec",
  "solar_roof_plan",
  "other",
]);
export type DocumentType = z.infer<typeof DocumentType>;

export const ItemStatus = z.enum(["complete", "incomplete", "missing", "not_applicable"]);
export type ItemStatus = z.infer<typeof ItemStatus>;
export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  complete: "Complete",
  incomplete: "Incomplete",
  missing: "Missing",
  not_applicable: "Not applicable",
};

export const Readiness = z.enum([
  "appears_ready",
  "action_required",
  "more_info_required",
  "staff_guidance_recommended",
]);
export type Readiness = z.infer<typeof Readiness>;
export const READINESS_LABELS: Record<Readiness, string> = {
  appears_ready: "Appears ready to submit",
  action_required: "Application incomplete",
  more_info_required: "More information required",
  staff_guidance_recommended: "Staff guidance recommended",
};

export const FindingCategory = z.enum(["missing", "incomplete", "unclear", "inconsistent", "wrong"]);
export type FindingCategory = z.infer<typeof FindingCategory>;

export const Severity = z.enum(["blocker", "warning", "info"]);
export type Severity = z.infer<typeof Severity>;

/** InfoPkg §8 file-validation codes. */
export const FileFindingCode = z.enum([
  "WRONG_FORMAT", // FILE-001
  "PASSWORD_PROTECTED", // FILE-002
  "UNCLEAR_NAME", // FILE-003
  "DUPLICATE", // FILE-004
  "SIGNATURE_MISSING", // FILE-005
  "ADDRESS_MISMATCH", // FILE-006
  "COMBINED_TYPES", // FILE-007
  "UNREADABLE", // FILE-008
]);
export type FileFindingCode = z.infer<typeof FileFindingCode>;

export const FILE_FINDING_MESSAGES: Record<FileFindingCode, string> = {
  WRONG_FORMAT: "Upload the plan as a PDF.",
  PASSWORD_PROTECTED: "Upload an unsecured version of the PDF.",
  UNCLEAR_NAME: "Rename the file so its content can be identified.",
  DUPLICATE: "Confirm which version should be included.",
  SIGNATURE_MISSING: "Add the applicable signature before submission.",
  ADDRESS_MISMATCH: "Confirm the correct project address.",
  COMBINED_TYPES: "Separate or label the documents so they can be identified.",
  UNREADABLE: "Replace the file with a readable copy.",
};

// ───────────────────────── Conditions & requirements ─────────────────────────

const Scalar = z.union([z.string(), z.number(), z.boolean()]);

export type Condition =
  | { fact: string; eq?: z.infer<typeof Scalar>; gte?: number; lt?: number; in?: z.infer<typeof Scalar>[] }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z
      .object({
        fact: z.string(),
        eq: Scalar.optional(),
        gte: z.number().optional(),
        lt: z.number().optional(),
        in: z.array(Scalar).optional(),
      })
      .strict(),
    z.object({ all: z.array(Condition) }).strict(),
    z.object({ any: z.array(Condition) }).strict(),
    z.object({ not: Condition }).strict(),
  ]),
);

/** A link that tells applicants where to find guidance, a form or a standard detail. */
export const Link = z.object({
  label: z.string(),
  url: z.string().url(),
  kind: z.enum(["guide", "form", "standard_detail"]).default("guide"),
});
export type Link = z.infer<typeof Link>;

export const DetailRequirement = z.object({
  /** Stable id: "<type>.<doc>.<detail>", e.g. "deck.side_view.guard_height". */
  id: z.string().regex(/^[a-z_]+\.[a-z_]+\.[a-z_]+$/),
  label: z.string(),
  /** Message shown when this detail is missing (InfoPkg wording where one exists). */
  missingMessage: z.string(),
  /** Where on the form or drawing the applicant should add it. */
  whereToAdd: z.string(),
  appliesWhen: Condition.optional(),
  staffGuidance: z.boolean().optional(),
  /** Also reported as its own issue when the whole document is missing. */
  reportWhenDocumentMissing: z.boolean().optional(),
});
export type DetailRequirement = z.infer<typeof DetailRequirement>;

export const Requirement = z.object({
  id: z.string(),
  label: z.string(),
  plainLanguage: z.string(),
  /** The one PDF this requirement is checked against. Requirements sharing a document type form one page. */
  documentType: DocumentType,
  /** Message when the whole document is absent. */
  missingMessage: z.string(),
  details: z.array(DetailRequirement).default([]),
  appliesWhen: Condition.optional(),
  infoPkgSection: z.string(), // e.g. "§5.3"
  resourceIds: z.array(z.string()).default([]),
  /** Direct links telling applicants where to find guidance, forms and standard details. */
  links: z.array(Link).default([]),
});
export type Requirement = z.infer<typeof Requirement>;

export const PermitTrigger = z.object({
  projectType: ProjectType,
  /** Permit treated as required when this holds. Absent → always required. */
  requiredWhen: Condition.optional(),
  explanation: z.string(),
});
export type PermitTrigger = z.infer<typeof PermitTrigger>;

/** A question asked before uploads; answers become facts used by permit triggers and `appliesWhen`. */
export const ThresholdQuestion = z.object({
  id: z.string(),
  fact: z.string(),
  text: z.string(),
  help: z.string().optional(),
  kind: z.enum(["yes_no", "number"]),
  unit: z.string().optional(),
  min: z.number().optional(),
  step: z.number().optional(),
  /** When answered "yes", the project needs staff guidance (unusual aspect). */
  unusualIfYes: z.string().optional(),
});
export type ThresholdQuestion = z.infer<typeof ThresholdQuestion>;

/** Answer to a threshold question: "yes" | "no" | "unsure" or a number. */
export type QuestionAnswer = "yes" | "no" | "unsure" | number;

export const RequirementSet = z.object({
  projectType: z.union([ProjectType, z.literal("general")]),
  infoPkgSection: z.string(),
  permitTrigger: PermitTrigger.optional(),
  questions: z.array(ThresholdQuestion).default([]),
  requirements: z.array(Requirement),
});
export type RequirementSet = z.infer<typeof RequirementSet>;

export const Resource = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  description: z.string().optional(),
  lastVerified: z.string().optional(),
});
export type Resource = z.infer<typeof Resource>;

// ───────────────────────── Project options & document types (data/*.json) ─────────────────────────

export const ProjectOption = z.object({
  type: ProjectType,
  label: z.string(),
  description: z.string(),
  keywords: z.array(z.string()).default([]),
});
export type ProjectOption = z.infer<typeof ProjectOption>;

export const DocumentTypesConfig = z.object({
  documentTypes: z.array(z.object({ type: DocumentType, label: z.string() })),
});
export type DocumentTypesConfig = z.infer<typeof DocumentTypesConfig>;

// ───────────────────────── Questionnaire / classification ─────────────────────────

const YesNoUnsure = z.enum(["yes", "no", "unsure"]);

export const QuestionnaireAnswers = z.object({
  applicantKind: z.enum(["homeowner", "contractor_designer", "business", "unsure"]).optional(),
  buildingKind: z.enum(["house", "commercial_unit", "industrial", "institutional", "unsure"]).optional(),
  workKind: z
    .enum([
      "finish_basement",
      "deck_or_porch",
      "garage_or_shed",
      "addition",
      "solar",
      "interior_alteration",
      "other",
      "unsure",
    ])
    .optional(),
  freeText: z.string().optional(),
  deckHeightMetres: z.number().nonnegative().optional(),
  permanentRoof: YesNoUnsure.optional(),
  solarAreaM2: z.number().nonnegative().optional(),
  solarMountedToBuilding: YesNoUnsure.optional(),
  hasKitchenOrBathroom: YesNoUnsure.optional(),
  changeOfUse: YesNoUnsure.optional(),
  removesStructuralElement: YesNoUnsure.optional(),
  multiUnitOrHeritage: YesNoUnsure.optional(),
});
export type QuestionnaireAnswers = z.infer<typeof QuestionnaireAnswers>;

export const ClassificationResult = z.object({
  projectType: ProjectType.nullable(),
  category: ProjectCategory.nullable(),
  permitRequired: z.union([z.boolean(), z.literal("unknown")]),
  reasons: z.array(z.string()),
  unusualAspects: z.array(z.string()).default([]),
});
export type ClassificationResult = z.infer<typeof ClassificationResult>;

export const ChecklistItem = z.object({
  requirementId: z.string(),
  label: z.string(),
  plainLanguage: z.string(),
  documentType: DocumentType,
  details: z.array(z.object({ id: z.string(), label: z.string(), whereToAdd: z.string() })),
  resources: z.array(Resource),
  links: z.array(Link).default([]),
  infoPkgSection: z.string(),
});
export type ChecklistItem = z.infer<typeof ChecklistItem>;

// ───────────────────────── Submission (engine input) ─────────────────────────

export const ApplicationInfo = z.object({
  application_id: z.string(),
  applicant_name: z.string(),
  applicant_organisation: z.string().optional(),
  property_address: z.string(),
  applicant_role: z.string(),
  project_category: ProjectCategory,
  project_type: ProjectType,
  project_description: z.string(),
  estimated_construction_value: z.number().nonnegative(),
  submission_method: z.string().default("Online"),
  submission_date: z.string(), // ISO yyyy-mm-dd
  declaration_completed: z.boolean(),
  signature_present: z.boolean(),
});
export type ApplicationInfo = z.infer<typeof ApplicationInfo>;

export const SubmittedDocument = z.object({
  filename: z.string(),
  document_type: DocumentType,
  present: z.boolean(),
  /** DetailRequirement ids visibly shown on this document. */
  shown_details: z.array(z.string()).default([]),
  /** Legacy InfoPkg §9 fields — informational only, never trusted by the engine. */
  complete: z.boolean().optional(),
  issues: z.array(z.string()).optional(),
});
export type SubmittedDocument = z.infer<typeof SubmittedDocument>;

export const Submission = z.object({
  application: ApplicationInfo,
  project_attributes: z.record(z.union([z.number(), z.boolean(), z.string()])).default({}),
  documents: z.array(SubmittedDocument),
  flags: z.object({ unusual_aspects: z.array(z.string()).default([]) }).default({ unusual_aspects: [] }),
});
export type Submission = z.infer<typeof Submission>;

// ───────────────────────── Findings & evidence ─────────────────────────

export const BBox = z.tuple([z.number(), z.number(), z.number(), z.number()]); // PDF points [x0,y0,x1,y1], origin top-left
export type BBox = z.infer<typeof BBox>;

export const Evidence = z.object({
  filename: z.string(),
  page: z.number().int().positive(),
  bbox: BBox.optional(),
  /** true when bbox marks where the item is expected rather than where it was found. */
  expectedRegion: z.boolean().default(false),
  cropUrl: z.string().optional(),
  quote: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  confidence: z.number().min(0).max(1),
  /** rule = file check; form_field = from the application details; review = the review API. */
  source: z.enum(["rule", "form_field", "review"]),
});
export type Evidence = z.infer<typeof Evidence>;

export const FindingReference = z.object({
  requirementLabel: z.string(),
  infoPkgSection: z.string(),
  cityUrl: z.string().url(),
  standardDetailUrl: z.string().url().optional(),
  howToFix: z.string(),
  /** Where on the form or drawing to add the missing item. */
  whereToAdd: z.string().optional(),
  links: z.array(Link).optional(),
});
export type FindingReference = z.infer<typeof FindingReference>;

export const Finding = z.object({
  id: z.string(),
  category: FindingCategory,
  severity: Severity,
  requirementId: z.string().optional(),
  detailId: z.string().optional(),
  fileCode: FileFindingCode.optional(),
  message: z.string(),
  evidence: z.array(Evidence).default([]),
  conflictsWith: z.array(Evidence).optional(),
  reference: FindingReference.optional(),
  staffGuidance: z.boolean().optional(),
  userOverridden: z.boolean().optional(),
});
export type Finding = z.infer<typeof Finding>;

// ───────────────────────── Report (engine output) ─────────────────────────

export const ReportItem = z.object({
  requirementId: z.string(),
  label: z.string(),
  status: ItemStatus,
  issues: z.array(z.object({ detailId: z.string(), message: z.string(), staffGuidance: z.boolean().optional() })),
  resources: z.array(Resource),
});
export type ReportItem = z.infer<typeof ReportItem>;

export const ReadinessReport = z.object({
  application_id: z.string(),
  project_type: ProjectType.nullable(),
  permit_required: z.union([z.boolean(), z.literal("unknown")]),
  readiness: Readiness,
  readiness_label: z.string(),
  items: z.array(ReportItem),
  findings: z.array(Finding),
  missing_item_count: z.number().int().nonnegative(),
  formal_approval: z.literal(false),
  disclaimer: z.literal(DISCLAIMER),
});
export type ReadinessReport = z.infer<typeof ReadinessReport>;

// ───────────────────────── Review service API (services/review) ─────────────────────────

export const ReviewedDocument = z.object({
  filename: z.string(),
  document_type: DocumentType,
  /** Detail ids the document shows (filled by the custom review API; empty until it is integrated). */
  shown_details: z.array(z.string()).default([]),
  /** Where each shown detail was found (key = detail id, or "near:<detail id>" for where it belongs). */
  detail_evidence: z.record(Evidence).default({}),
});
export type ReviewedDocument = z.infer<typeof ReviewedDocument>;

/** POST /review multipart: files[] + field `submission` (JSON of ReviewRequest). */
export const ReviewRequest = z.object({
  application: ApplicationInfo,
  project_attributes: z.record(z.union([z.number(), z.boolean(), z.string()])).default({}),
  /** filename → document type, from the page the applicant uploaded it on. */
  document_hints: z.record(DocumentType).default({}),
});
export type ReviewRequest = z.infer<typeof ReviewRequest>;

export const ReviewResponse = z.object({
  documents: z.array(ReviewedDocument),
  findings: z.array(Finding),
  /** Facts read from the documents (e.g. removes_existing_exterior_wall), merged into project_attributes. */
  inferred_attributes: z.record(z.union([z.number(), z.boolean(), z.string()])).default({}),
});
export type ReviewResponse = z.infer<typeof ReviewResponse>;

// ───────────────────────── InfoPkg §9 compatibility ─────────────────────────

const InfoPkgS9 = z.object({
  application: z.object({
    application_id: z.string(),
    applicant_name: z.string(),
    property_address: z.string(),
    applicant_role: z.string(),
    project_category: z.string(),
    project_type: z.string(),
    project_description: z.string(),
    estimated_construction_value: z.number(),
    submission_method: z.string(),
    submission_date: z.string(),
    declaration_completed: z.boolean(),
    signature_present: z.boolean(),
  }),
  project_attributes: z.record(z.union([z.number(), z.boolean(), z.string()])).default({}),
  documents: z.array(
    z.object({
      filename: z.string(),
      document_type: z.string(),
      present: z.boolean(),
      complete: z.boolean().optional(),
      issues: z.array(z.string()).optional(),
    }),
  ),
});

const INFOPKG_PROJECT_TYPES: Record<string, ProjectType> = {
  deck: "deck_porch",
  "rear-yard deck": "deck_porch",
  "basement renovation": "basement_renovation",
  "detached garage": "detached_garage",
  "residential addition": "residential_addition",
  "one-storey rear addition": "residential_addition",
  "rooftop solar-panel installation": "solar_panels",
  "commercial interior alteration": "ici_interior_alteration",
};

/** Infer a DocumentType from an InfoPkg filename (Deck_Side_View.pdf → deck_side_view). */
export function documentTypeFromFilename(filename: string): DocumentType {
  const key = filename.replace(/\.[a-z0-9]+$/i, "").toLowerCase().replace(/[^a-z]+/g, "_");
  const table: [RegExp, DocumentType][] = [
    [/application_form/, "application_form"],
    [/project_description/, "project_description"],
    [/side_view/, "deck_side_view"],
    [/deck_plan/, "deck_plan"],
    [/site_plan/, "site_plan"],
    [/existing_floor_plan/, "existing_floor_plan"],
    [/proposed_floor_plan/, "proposed_floor_plan"],
    [/floor_plan/, "floor_plan"],
    [/foundation/, "foundation_plan"],
    [/solar_roof_plan/, "solar_roof_plan"],
    [/roof_plan/, "roof_plan"],
    [/elevation/, "elevations"],
    [/key_plan/, "key_plan"],
    [/architectural/, "architectural_plan"],
    [/plumbing/, "plumbing_plan"],
    [/mechanical|hvac/, "hvac_plan"],
    [/electrical/, "electrical_plan"],
    [/equipment/, "equipment_layout"],
    [/code_matrix/, "code_matrix"],
    [/structural_review/, "structural_review"],
    [/mounting/, "mounting_system_spec"],
    [/panel_spec/, "panel_spec"],
  ];
  return table.find(([re]) => re.test(key))?.[1] ?? "other";
}

/** Accepts the InfoPkg §9 sample JSON verbatim and returns a Submission (shown_details empty). */
export function parseInfoPkgJson(input: unknown): Submission {
  const raw = InfoPkgS9.parse(input);
  const pt = INFOPKG_PROJECT_TYPES[raw.application.project_type.toLowerCase()];
  if (!pt) throw new Error(`Unknown InfoPkg project_type: ${raw.application.project_type}`);
  return Submission.parse({
    application: { ...raw.application, project_type: pt, project_category: PROJECT_TYPE_CATEGORY[pt] },
    project_attributes: raw.project_attributes,
    documents: raw.documents.map((d) => ({
      filename: d.filename,
      document_type: documentTypeFromFilename(d.filename),
      present: d.present,
      shown_details: [],
      complete: d.complete,
      issues: d.issues,
    })),
  });
}
