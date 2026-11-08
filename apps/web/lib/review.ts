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

/** The review for a page, but only if it was run on the file currently on that page. */
export function currentReview(file: UploadedFile | undefined, review: PageReview | undefined): PageReview | undefined {
  return file && review && review.file === file ? review : undefined;
}
// (application details typed in earlier steps are used for consistency checks only, never to tick fields)

/** Result of the automatic check, tied to the exact file it was run on (`file`). */
export type PageReview = { file?: UploadedFile } & (
  | { status: "checking" }
  | { status: "done"; result: VisionReviewResponse }
  | { status: "error"; reason: string; findings: Finding[] }
);

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

export type DetailState = "found" | "not_found" | "pending" | "checking";

export interface DetailCheck {
  id: string;
  label: string;
  whereToAdd: string;
  state: DetailState;
  evidence?: Evidence;
}

/**
 * Machine status of every field on one page, read ONLY from the PDF uploaded on this page.
 * Nothing entered in earlier steps ticks anything here: no file → "pending"; after upload → "found"/"not_found".
 */
export function pageChecks(page: DocumentPage, review: PageReview | undefined, hasFile: boolean): DetailCheck[] {
  const result = review?.status === "done" ? review.result : undefined;
  const doc = result?.documents[0];
  const shown = new Set(doc?.shown_details ?? []);
  return page.items.flatMap((item) => item.details.map((d): DetailCheck => {
    const base = { id: d.id, label: d.label, whereToAdd: d.whereToAdd };
    if (!hasFile) return { ...base, state: "pending" };
    if (!review || review.status === "checking") return { ...base, state: "checking" };
    if (!result) return { ...base, state: "not_found" }; // could not be checked
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
  return hasFile && review?.status === "done" && fileFindings(review).length === 0 && checks.every((c) => c.state === "found");
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
  const review = (p: DocumentType) => currentReview(i.files[p], i.reviews[p]);
  const done = (p: DocumentType) => { const r = review(p); return r?.status === "done" ? r.result : undefined; };
  const inferred = Object.assign({}, ...pages.map((p) => done(p.documentType)?.inferred_attributes ?? {}));
  // Form fields (including signature and declaration) are judged from the uploaded form by the engine;
  // these flags only record what the applicant confirmed in the Declaration step.
  const application = { ...i.application, declaration_completed: i.declaration.declared, signature_present: i.declaration.signed };
  const documents = pages.flatMap((p) => {
    const f = i.files[p.documentType];
    if (!f) return [];
    return [{ filename: f.name, document_type: p.documentType, present: true, shown_details: done(p.documentType)?.documents[0]?.shown_details ?? [] }];
  });
  const findings = [...pages.flatMap((p) => fileFindings(review(p.documentType))), ...(i.extraFindings ?? [])];
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
