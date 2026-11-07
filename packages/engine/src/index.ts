/** @permit/engine — OWNER: Codex-A. Pure, synchronous, no I/O. See docs/CONTRACTS.md §3. */
import type {
  ChecklistItem, ClassificationResult, Finding, ProjectType, QuestionnaireAnswers, ReadinessReport, Submission,
} from "@permit/schema";

export function classify(_answers: QuestionnaireAnswers): ClassificationResult {
  throw new Error("not implemented");
}

export function buildChecklist(_type: ProjectType, _attrs: Record<string, number | boolean | string> = {}): ChecklistItem[] {
  throw new Error("not implemented");
}

export function evaluate(_submission: Submission, _findings: Finding[] = []): ReadinessReport {
  throw new Error("not implemented");
}
