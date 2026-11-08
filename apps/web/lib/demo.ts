"use client";
import { documentPages, questionsFor } from "@permit/engine";
import type { DocumentType, QuestionAnswer } from "@permit/schema";
import { EMPTY_DECLARATION, type AppState, type UploadedFile } from "./store";
import type { DemoScenario } from "./scenarios";
import { factsFor } from "./review";

/**
 * Load a sample application: preview answers (from the scenario's attributes; unanswered yes/no questions
 * default to "no"), application details, and each generated PDF on its document page.
 * Files with no matching page (e.g. a plumbing sketch for a basement) are not loaded.
 */
export async function loadDemo(s: DemoScenario): Promise<{ patch: Partial<AppState>; files: Partial<Record<DocumentType, UploadedFile>> }> {
  const type = s.application.project_type;
  const attrs = s.project_attributes;
  const answers: Record<string, QuestionAnswer> = {};
  for (const q of questionsFor(type)) {
    const v = attrs[q.fact];
    if (q.kind === "number") { if (typeof v === "number") answers[q.id] = v; }
    else answers[q.id] = v === true ? "yes" : "no";
  }
  const pages = documentPages(type, factsFor(type, answers)).map((p) => p.documentType);
  const files: Partial<Record<DocumentType, UploadedFile>> = {};
  for (const d of s.documents.filter((d) => d.present)) {
    const page = d.document_type as DocumentType;
    if (!pages.includes(page) || files[page]) continue;
    const res = await fetch(`/demo/${s.application.application_id}/${d.filename}`);
    if (res.ok) files[page] = { name: d.filename, bytes: new Uint8Array(await res.arrayBuffer()), type: "application/pdf" };
  }
  return {
    patch: {
      projectType: type,
      projectQuery: "",
      answers,
      application: s.application,
      declaration: { ...EMPTY_DECLARATION, name: s.application.applicant_name },
      visited: ["/project", "/preview", "/application", "/requirements"],
      demoId: s.application.application_id,
    },
    files,
  };
}
