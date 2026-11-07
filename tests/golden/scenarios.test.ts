import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISCLAIMER, Submission, ReadinessReport } from "@permit/schema";
import { evaluate, uniqueMessages } from "@permit/engine";

const dir = join(__dirname, "../../data/scenarios");
const scenarios = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

describe("golden scenarios (InfoPkg §6–7)", () => {
  it("has all 7 scenarios", () => expect(scenarios).toHaveLength(7));

  for (const s of scenarios) {
    it(`${s.application.application_id} — ${s.title}`, () => {
      const report = evaluate(Submission.parse(s));
      expect(ReadinessReport.parse(report)).toBeTruthy();
      expect(report.readiness).toBe(s.expected.readiness);
      expect(new Set(uniqueMessages(report))).toEqual(new Set(s.expected.messages));
      expect(report.missing_item_count).toBe(s.expected.missing_item_count);
      expect(report.formal_approval).toBe(false);
      expect(report.disclaimer).toBe(DISCLAIMER);
    });
  }

  it("control scenario has zero findings", () => {
    const control = scenarios.find((s) => s.application.application_id === "MOCK-CONTROL-001");
    expect(evaluate(Submission.parse(control)).findings).toHaveLength(0);
  });
});
