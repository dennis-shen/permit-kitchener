import { describe, expect, it } from "vitest";
import { DISCLAIMER, type ReadinessReport } from "@permit/schema";
import { classifyFreeText, explain, keywordClassify } from "./index";

const report: ReadinessReport = {
  application_id: "X", project_type: "deck_porch", permit_required: true, readiness: "action_required",
  readiness_label: "Action required", items: [], missing_item_count: 1, formal_approval: false, disclaimer: DISCLAIMER,
  findings: [{ id: "a", category: "incomplete", severity: "blocker", message: "Add the guard height.", evidence: [],
    reference: { requirementLabel: "Side view", infoPkgSection: "§5.3", cityUrl: "https://www.kitchener.ca/", howToFix: "Add the guard height." } }],
};

describe("explain", () => {
  it("falls back without a key", async () => {
    expect(await explain(report, undefined)).toEqual({ a: "Add the guard height." });
  });
  it("uses model text but rejects approval language and unknown ids", async () => {
    const good = await explain(report, async () => '{"a": "Write how tall the railing is on the side drawing.", "zzz": "x"}');
    expect(good).toEqual({ a: "Write how tall the railing is on the side drawing." });
    const bad = await explain(report, async () => '{"a": "Your deck is approved."}');
    expect(bad).toEqual({ a: "Add the guard height." });
    const broken = await explain(report, async () => "not json");
    expect(broken).toEqual({ a: "Add the guard height." });
  });
});

describe("classifyFreeText", () => {
  it("keyword fallback", async () => {
    expect((await classifyFreeText("I want to build a deck in my backyard", undefined)).projectType).toBe("deck_porch");
    expect(keywordClassify("something vague").projectType).toBeNull();
    expect(keywordClassify("solar on my garage").projectType).toBeNull(); // ambiguous → ask
  });
  it("ignores low-confidence model answers", async () => {
    const r = await classifyFreeText("a deck", async () => '{"projectType":"solar_panels","confidence":0.2}');
    expect(r.projectType).toBe("deck_porch");
  });
});
