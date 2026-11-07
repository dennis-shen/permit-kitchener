"use client";
import { buildChecklist, factsFromAnswers, questionsFor } from "@permit/engine";
import type { QuestionAnswer } from "@permit/schema";
import { OTHER_SLOT, type AppState, type UploadedFile } from "./store";
import type { DemoScenario } from "./scenarios";

/**
 * Load a sample application: application details, answers to the threshold questions
 * (from the scenario's attributes; unanswered yes/no questions default to "no"),
 * and its generated drawings placed in the matching requirement slots.
 */
export async function loadDemo(s: DemoScenario): Promise<{ patch: Partial<AppState>; files: Record<string, UploadedFile[]> }> {
  const type = s.application.project_type;
  const attrs = s.project_attributes;
  const answers: Record<string, QuestionAnswer> = {};
  for (const q of questionsFor(type)) {
    const v = attrs[q.fact];
    if (q.kind === "number") { if (typeof v === "number") answers[q.id] = v; }
    else answers[q.id] = v === true ? "yes" : "no";
  }
  const checklist = buildChecklist(type, factsFromAnswers(type, answers));
  const files: Record<string, UploadedFile[]> = {};
  for (const d of s.documents.filter((d) => d.present)) {
    const res = await fetch(`/demo/${s.application.application_id}/${d.filename}`);
    if (!res.ok) continue;
    const file = { name: d.filename, bytes: new Uint8Array(await res.arrayBuffer()), type: "application/pdf" };
    const slot = checklist.find((c) => c.documentType === d.document_type)?.requirementId ?? OTHER_SLOT;
    (files[slot] ??= []).push(file);
  }
  return {
    patch: {
      projectType: type,
      projectQuery: "",
      application: s.application,
      answers,
      checks: {},
      review: null,
      demoId: s.application.application_id,
    },
    files,
  };
}
