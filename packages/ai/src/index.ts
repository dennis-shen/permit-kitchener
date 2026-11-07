/** @permit/ai — OWNER: Kiro-2. Server-only. Optional; every function has a deterministic fallback. */
import type { ProjectType, ReadinessReport } from "@permit/schema";

/** Plainer-language howToFix per finding id. Must not add or remove findings. */
export async function explain(_report: ReadinessReport): Promise<Record<string, string>> {
  throw new Error("not implemented");
}

export interface FreeTextClassification { projectType: ProjectType | null; confidence: number; followUpQuestions: string[] }

export async function classifyFreeText(_text: string): Promise<FreeTextClassification> {
  throw new Error("not implemented");
}
