import {
  Submission,
  type ApplicationInfo,
  type Finding,
  type ProjectType,
  type ReadinessReport,
  type SubmittedDocument,
  type VisionReviewResponse,
} from "@permit/schema";
import { evaluate } from "@permit/engine";

export interface ReviewState {
  application: ApplicationInfo;
  attributes: Record<string, number | boolean | string>;
  vision: VisionReviewResponse | null;
  visionError?: string;
  prechecks: Finding[];
  /** Manual "my drawing shows…" answers, used when the vision service is unavailable. */
  manualDocs: SubmittedDocument[];
  overrides: string[];
  unusualAspects: string[];
}

/** Combine the application, what the vision service read, and user overrides into an engine report. */
export function buildReport(s: ReviewState): { submission: Submission; report: ReadinessReport } {
  const v = s.vision;
  const docs: SubmittedDocument[] = v
    ? v.documents
        .filter((d) => d.pages > 0)
        .map((d) => ({ filename: d.filename, document_type: d.document_type, present: true, shown_details: d.shown_details }))
    : s.manualDocs;
  const application = {
    ...s.application,
    signature_present: v?.form_fields.signature_present ?? s.application.signature_present,
    declaration_completed: v?.form_fields.declaration_completed ?? s.application.declaration_completed,
  };
  const submission = Submission.parse({
    application,
    project_attributes: { ...s.attributes, ...(v?.inferred_attributes ?? {}) },
    documents: docs,
    flags: { unusual_aspects: s.unusualAspects },
  });
  const extra = dedupe([...(v?.findings ?? []), ...s.prechecks]);
  const overrides: Finding[] = s.overrides.map((id) => ({
    id, category: "incomplete", severity: "info", message: "", evidence: [], userOverridden: true,
  }));
  const report = evaluate(submission, [...extra.filter((f) => !s.overrides.includes(f.id)), ...overrides]);
  // Point engine findings at where the item belongs on the drawing, when the reviewer found a nearby label.
  if (v) {
    for (const f of report.findings) {
      if (!f.id.startsWith("eng:") || !f.detailId) continue;
      for (const d of v.documents) {
        const near = d.detail_evidence[`near:${f.detailId}`];
        if (near) { f.evidence = [near]; break; }
      }
    }
  }
  return { submission, report };
}

function dedupe(fs: Finding[]): Finding[] {
  const seen = new Set<string>();
  return fs.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}

export const EMPTY_APPLICATION = (type: ProjectType | null): ApplicationInfo => ({
  application_id: "DRAFT-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
  applicant_name: "",
  property_address: "",
  applicant_role: "Property owner",
  project_category: type === "ici_interior_alteration" ? "ICI" : type === "solar_panels" ? "Miscellaneous" : "Residential",
  project_type: type ?? "deck_porch",
  project_description: "",
  estimated_construction_value: 0,
  submission_method: "Online",
  submission_date: new Date().toISOString().slice(0, 10),
  declaration_completed: false,
  signature_present: false,
});
