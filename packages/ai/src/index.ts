/**
 * @permit/ai — optional plain-language layer. Server-only. Every function has a deterministic
 * fallback, so results (readiness and finding ids) never depend on whether AI is available.
 */
import { FORBIDDEN_PHRASES, type ProjectType, type ReadinessReport } from "@permit/schema";
import { z } from "zod";

export const MODEL = process.env.AI_MODEL ?? "claude-sonnet-5-5";

const SYSTEM = `You help homeowners understand what to add to a City of Kitchener building permit application.
Rewrite each "how to fix" note in plain language (grade 8, at most 30 words, active voice).
Never say an application is approved, compliant, guaranteed or complete. Do not add new requirements
or legal advice. Keep every id exactly as given. Reply with JSON only: {"<id>": "<text>", ...}.`;

export interface Caller {
  (system: string, user: string): Promise<string>;
}

/** Default caller: Anthropic Messages API over fetch. Undefined when no key is configured. */
export function anthropicCaller(apiKey = process.env.ANTHROPIC_API_KEY): Caller | undefined {
  if (!apiKey) return undefined;
  return async (system, user) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);
    const body = (await res.json()) as { content: { type: string; text?: string }[] };
    return body.content.map((c) => c.text ?? "").join("");
  };
}

const safe = (t: string) => !FORBIDDEN_PHRASES.some((p) => t.toLowerCase().includes(p));

function fallbackExplain(report: ReadinessReport): Record<string, string> {
  return Object.fromEntries(report.findings.map((f) => [f.id, f.reference?.howToFix ?? f.message]));
}

/** Plainer how-to-fix text keyed by finding id. Never adds or removes findings. */
export async function explain(report: ReadinessReport, call: Caller | undefined = anthropicCaller()): Promise<Record<string, string>> {
  const base = fallbackExplain(report);
  if (!call || report.findings.length === 0) return base;
  try {
    const text = await call(SYSTEM, JSON.stringify(base));
    const parsed = z.record(z.string()).parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
    // Only accept known ids with safe text; everything else keeps the deterministic wording.
    return Object.fromEntries(Object.entries(base).map(([id, t]) => [id, parsed[id] && safe(parsed[id]!) ? parsed[id]! : t]));
  } catch {
    return base;
  }
}

export interface FreeTextClassification {
  projectType: ProjectType | null;
  confidence: number;
  followUpQuestions: string[];
}

const KEYWORDS: [ProjectType, RegExp][] = [
  ["solar_panels", /\bsolar|photovoltaic|pv panel/i],
  ["deck_porch", /\bdeck|porch|veranda/i],
  ["detached_garage", /\bgarage|shed|carport|accessory (building|structure)/i],
  ["residential_addition", /\baddition|extend (the|my) house|extension|sunroom/i],
  ["basement_renovation", /\bbasement|rec(reation)? room|finish(ing)? the lower level/i],
  ["ici_interior_alteration", /\b(caf[eé]|restaurant|store|retail|office|unit|tenant|commercial|clinic|warehouse)\b/i],
];

const FOLLOW_UPS: Record<ProjectType, string[]> = {
  solar_panels: ["Will the panels be mounted on a building?", "What is the total panel area in square metres?"],
  deck_porch: ["How high is the deck above the ground at its highest point?", "Will it have a permanent roof?"],
  detached_garage: ["What are the proposed dimensions?"],
  residential_addition: ["Will any existing exterior wall be removed?"],
  basement_renovation: ["Will you add a kitchen or bathroom?"],
  ici_interior_alteration: ["Is the proposed use different from the previous use?"],
};

export function keywordClassify(text: string): FreeTextClassification {
  const hits = KEYWORDS.filter(([, rx]) => rx.test(text));
  if (hits.length !== 1) {
    return { projectType: null, confidence: 0, followUpQuestions: ["What kind of work are you planning?"] };
  }
  const t = hits[0]![0];
  return { projectType: t, confidence: 0.7, followUpQuestions: FOLLOW_UPS[t] };
}

const FreeText = z.object({
  projectType: z.enum(["basement_renovation", "deck_porch", "detached_garage", "residential_addition", "solar_panels", "ici_interior_alteration"]).nullable(),
  confidence: z.number().min(0).max(1),
});

/** Suggest a project type from a free-text description (keyword fallback without AI). */
export async function classifyFreeText(text: string, call: Caller | undefined = anthropicCaller()): Promise<FreeTextClassification> {
  const kw = keywordClassify(text);
  if (!call) return kw;
  try {
    const out = await call(
      'Classify the building project into one of: basement_renovation, deck_porch, detached_garage, residential_addition, solar_panels, ici_interior_alteration, or null if unclear. Reply JSON only: {"projectType": ..., "confidence": 0-1}.',
      text,
    );
    const p = FreeText.parse(JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)));
    if (!p.projectType || p.confidence < 0.6) return kw;
    return { projectType: p.projectType, confidence: p.confidence, followUpQuestions: FOLLOW_UPS[p.projectType] };
  } catch {
    return kw;
  }
}
