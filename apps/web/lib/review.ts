/**
 * Automatic checks: each document page's PDF is saved on the server and reviewed there (lib/store.tsx),
 * and the engine combines every page's result into one report. No user ticks — machine checks only.
 */
import {
  DETAIL_INDEX, DOCUMENT_LABELS, documentPages, evaluate, factsFromAnswers, REQUIREMENT_INDEX, unusualFromAnswers, type DocumentPage,
} from "@permit/engine";
import {
  Submission, type ApplicationInfo, type DocumentType, type Evidence, type Finding, type ProjectType, type QuestionAnswer,
  type ReadinessReport, type ReviewResponse,
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
  | { status: "done"; result: ReviewResponse }
  | { status: "error"; reason: string; findings: Finding[] }
);

export type Facts = Record<string, number | boolean | string>;

export function factsFor(type: ProjectType, answers: Record<string, QuestionAnswer>): Facts {
  return factsFromAnswers(type, answers) as Facts;
}

export type DetailState = "found" | "not_found" | "pending" | "checking";

export interface DetailCheck {
  id: string;
  label: string;
  whereToAdd: string;
  /** Filled in only where it applies; never blocks the page. */
  optional?: boolean;
  state: DetailState;
  evidence?: Evidence;
}

/**
 * PLACEHOLDER: until the custom review API is integrated, uploading a PDF on a page ticks every item on
 * that page. The review service is still called for file problems (wrong format, unreadable, vague name,
 * duplicate). Set to `false` once the API fills `shown_details`.
 */
export const PLACEHOLDER_TICKS = true;

/**
 * Status of every field on one page, from the PDF uploaded on this page only.
 * Nothing entered in earlier steps ticks anything here: no file → "pending"; after upload → "found"/"not_found".
 */
export function pageChecks(page: DocumentPage, review: PageReview | undefined, hasFile: boolean): DetailCheck[] {
  const result = review?.status === "done" ? review.result : undefined;
  const doc = result?.documents[0];
  const shown = new Set(doc?.shown_details ?? []);
  return page.items.flatMap((item) => item.details.map((d): DetailCheck => {
    const base = { id: d.id, label: d.label, whereToAdd: d.whereToAdd, optional: d.optional };
    if (!hasFile) return { ...base, state: "pending" };
    if (PLACEHOLDER_TICKS) return { ...base, state: "found" };
    if (!review || review.status === "checking") return { ...base, state: "checking" };
    if (!result) return { ...base, state: "not_found" }; // could not be checked
    if (shown.has(d.id)) return { ...base, state: "found", evidence: doc?.detail_evidence[d.id] };
    return { ...base, state: "not_found", evidence: doc?.detail_evidence[`near:${d.id}`] };
  }));
}

/** Problems with the file itself (format, unreadable, vague name, duplicate…). */
export function fileFindings(review: PageReview | undefined): Finding[] {
  if (!review) return [];
  if (review.status === "error") return review.findings;
  if (review.status !== "done") return [];
  return review.result.findings;
}

export function pageComplete(checks: DetailCheck[], review: PageReview | undefined, hasFile: boolean): boolean {
  const ok = (c: DetailCheck) => c.state === "found" || (!!c.optional && c.state === "not_found");
  if (PLACEHOLDER_TICKS) return hasFile && fileFindings(review).length === 0 && checks.every(ok);
  return hasFile && review?.status === "done" && fileFindings(review).length === 0 && checks.every(ok);
}

/** Every field ticked on the PDFs uploaded so far (by detail id). */
export function foundOnUploads(type: ProjectType, answers: Record<string, QuestionAnswer>,
  files: Partial<Record<DocumentType, UploadedFile>>, reviews: Partial<Record<DocumentType, PageReview>>): Set<string> {
  return new Set(documentPages(type, factsFor(type, answers)).flatMap((p) => {
    const f = files[p.documentType];
    if (!f) return [];
    return pageChecks(p, currentReview(f, reviews[p.documentType]), true).filter((c) => c.state === "found").map((c) => c.id);
  }));
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
    const shown = PLACEHOLDER_TICKS
      ? p.items.flatMap((it) => it.details.map((d) => d.id)) // placeholder: an uploaded PDF shows everything on its page
      : done(p.documentType)?.documents[0]?.shown_details ?? [];
    return [{ filename: f.name, document_type: p.documentType, present: true, shown_details: shown }];
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
  if (f.fileCode) return problemText(f) || f.reference?.howToFix || "Replace the file on this page.";
  return f.reference?.whereToAdd ?? (f.detailId ? DETAIL_INDEX[f.detailId]?.whereToAdd : undefined) ?? f.reference?.howToFix ?? f.message;
}

/** Extra detail for a file problem, e.g. which page already has the same file. Empty when the message says it all. */
export function problemText(f: Finding): string {
  const e = f.evidence[0];
  if (f.fileCode === "DUPLICATE" && typeof e?.value === "string") {
    return `This is the same file as the one on the ${(DOCUMENT_LABELS[e.value] ?? e.value).toLowerCase()} page. Upload the right document here, or remove one of them.`;
  }
  if (f.conflictsWith?.[0]?.value !== undefined) return `(file: ${e?.value}; application: ${f.conflictsWith[0].value})`;
  return "";
}
