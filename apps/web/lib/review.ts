/**
 * Automatic checks: each document page's PDF is sent to the document reviewer on its own, and the
 * engine combines every page's result into one report. No user ticks — machine checks only.
 */
import {
  DETAIL_INDEX, documentPages, evaluate, factsFromAnswers, REQUIREMENT_INDEX, unusualFromAnswers, type DocumentPage,
} from "@permit/engine";
import { reviewFiles } from "@permit/files";
import {
  Submission, type ApplicationInfo, type DocumentType, type Evidence, type Finding, type ProjectType, type QuestionAnswer,
  type ReadinessReport, type VisionReviewResponse,
} from "@permit/schema";
import type { Declaration, UploadedFile } from "./store";

export type PageReview =
  | { status: "checking" }
  | { status: "done"; result: VisionReviewResponse }
  | { status: "error"; reason: string; findings: Finding[] };

export type Facts = Record<string, number | boolean | string>;

export function factsFor(type: ProjectType, answers: Record<string, QuestionAnswer>): Facts {
  return factsFromAnswers(type, answers) as Facts;
}

/** Send one page's PDF to the reviewer, telling it which document the applicant says it is. */
export async function checkPage(page: DocumentType, file: UploadedFile, application: ApplicationInfo, facts: Facts): Promise<PageReview> {
  const res = await reviewFiles(
    [{ name: file.name, bytes: file.bytes, mimeType: file.type }],
    { application, project_attributes: facts, document_hints: { [file.name]: page } },
  );
  return res.visionUnavailable ? { status: "error", reason: res.reason, findings: res.findings } : { status: "done", result: res };
}

/** Application-detail fields checked from what the applicant entered (Application step). */
const FROM_APPLICATION: Record<string, (a: ApplicationInfo) => boolean> = {
  "general.application.applicant_name": (a) => a.applicant_name.trim().split(/\s+/).length >= 2,
  "general.application.property_address": (a) => a.property_address.trim() !== "",
  "general.application.applicant_role": (a) => a.applicant_role.trim() !== "",
  "general.application.project_type": (a) => !!a.project_type,
  "general.application.project_description": (a) => a.project_description.trim() !== "",
  "general.application.estimated_construction_value": (a) => a.estimated_construction_value > 0,
  "general.application.submission_date": (a) => a.submission_date.trim() !== "",
};

export type DetailState = "found" | "not_found" | "pending" | "from_application" | "missing_from_application" | "at_declaration";

export interface DetailCheck {
  id: string;
  label: string;
  whereToAdd: string;
  state: DetailState;
  evidence?: Evidence;
  note?: string;
}

/** Machine status of every field on one page. */
export function pageChecks(page: DocumentPage, review: PageReview | undefined, application: ApplicationInfo, hasFile: boolean): DetailCheck[] {
  const result = review?.status === "done" ? review.result : undefined;
  const doc = result?.documents[0];
  const shown = new Set(doc?.shown_details ?? []);
  return page.items.flatMap((item) => item.details.map((d): DetailCheck => {
    const base = { id: d.id, label: d.label, whereToAdd: d.whereToAdd };
    const fromApp = FROM_APPLICATION[d.id];
    if (fromApp) return { ...base, state: fromApp(application) ? "from_application" : "missing_from_application" };
    if (d.id === "general.application.signature_present" || d.id === "general.application.declaration_completed") {
      const key = d.id.endsWith("signature_present") ? "signature_present" : "declaration_completed";
      const v = result?.form_fields[key];
      if (v === true) return { ...base, state: "found", note: key === "signature_present" ? "Signature found on the uploaded form." : "Declaration completed on the uploaded form." };
      if (v === false) return { ...base, state: "not_found", note: key === "signature_present" ? "No signature found in Section I of the uploaded form." : "The declaration on the uploaded form is not completed." };
      return { ...base, state: "at_declaration", note: "You confirm this in the Declaration step; we also check the uploaded form." };
    }
    if (!hasFile) return { ...base, state: "pending" };
    if (!result) return { ...base, state: "pending" };
    if (shown.has(d.id)) return { ...base, state: "found", evidence: doc?.detail_evidence[d.id] };
    return { ...base, state: "not_found", evidence: doc?.detail_evidence[`near:${d.id}`] };
  }));
}

/** Problems with the file itself (format, password, unreadable, address mismatch…). */
export function fileFindings(review: PageReview | undefined): Finding[] {
  if (!review) return [];
  if (review.status === "error") return review.findings;
  if (review.status !== "done") return [];
  return review.result.findings;
}

export function pageComplete(checks: DetailCheck[], review: PageReview | undefined, hasFile: boolean): boolean {
  return hasFile && review?.status === "done" && fileFindings(review).length === 0
    && checks.every((c) => c.state === "found" || c.state === "from_application" || c.state === "at_declaration");
}

export interface ReportInput {
  type: ProjectType;
  application: ApplicationInfo;
  answers: Record<string, QuestionAnswer>;
  declaration: Declaration;
  files: Partial<Record<DocumentType, UploadedFile>>;
  reviews: Partial<Record<DocumentType, PageReview>>;
  extraFindings?: Finding[];
}

/** Combine every page's automatic check, the application details and the declaration into one engine report. */
export function buildReport(i: ReportInput): ReadinessReport {
  const facts = factsFor(i.type, i.answers);
  const pages = documentPages(i.type, facts);
  const done = (p: DocumentType) => { const r = i.reviews[p]; return r?.status === "done" ? r.result : undefined; };
  const inferred = Object.assign({}, ...pages.map((p) => done(p.documentType)?.inferred_attributes ?? {}));
  const form = done("application_form")?.form_fields;
  const application = {
    ...i.application,
    declaration_completed: i.declaration.declared && form?.declaration_completed !== false,
    signature_present: i.declaration.signed && form?.signature_present !== false,
  };
  const documents = pages.flatMap((p) => {
    const f = i.files[p.documentType];
    if (!f) return [];
    return [{ filename: f.name, document_type: p.documentType, present: true, shown_details: done(p.documentType)?.documents[0]?.shown_details ?? [] }];
  });
  const findings = [...pages.flatMap((p) => fileFindings(i.reviews[p.documentType])), ...(i.extraFindings ?? [])];
  const report = evaluate(
    Submission.parse({ application, project_attributes: { ...facts, ...inferred }, documents, flags: { unusual_aspects: unusualFromAnswers(i.type, i.answers) } }),
    dedupe(findings),
  );
  // Point findings at the spot on the drawing where the item belongs, when the reviewer found a nearby label.
  for (const f of report.findings) {
    if (!f.id.startsWith("eng:") || !f.detailId) continue;
    const page = f.requirementId ? REQUIREMENT_INDEX[f.requirementId]?.documentType : undefined;
    const near = page ? done(page)?.documents[0]?.detail_evidence[`near:${f.detailId}`] : undefined;
    if (near) f.evidence = [near];
  }
  return report;
}

function dedupe(fs: Finding[]): Finding[] {
  const seen = new Set<string>();
  return fs.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}

/** Which document page a finding belongs to (for links back to that page). */
export function pageOf(f: Finding, files: Partial<Record<DocumentType, UploadedFile>>): DocumentType | undefined {
  if (f.requirementId) return REQUIREMENT_INDEX[f.requirementId]?.documentType;
  const name = f.evidence[0]?.filename;
  return (Object.entries(files) as [DocumentType, UploadedFile][]).find(([, file]) => file.name === name)?.[0];
}

export function whereToAddFor(f: Finding): string {
  return f.reference?.whereToAdd ?? (f.detailId ? DETAIL_INDEX[f.detailId]?.whereToAdd : undefined) ?? f.reference?.howToFix ?? f.message;
}
