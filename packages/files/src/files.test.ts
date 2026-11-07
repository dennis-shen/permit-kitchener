import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { precheckFiles, reviewFiles } from "./index";

const fix = (p: string) => new Uint8Array(readFileSync(join(__dirname, "../../../fixtures/files", p)));

describe("precheckFiles", () => {
  it("FILE-001: Word document → upload as PDF", async () => {
    const f = await precheckFiles([{ name: "FloorPlan.docx", bytes: fix("FILE-001/FloorPlan.docx") }]);
    expect(f.map((x) => x.message)).toEqual(["Upload the plan as a PDF."]);
  });
  it("FILE-003: vague filename", async () => {
    const f = await precheckFiles([{ name: "scan0004.pdf", bytes: fix("FILE-003/scan0004.pdf") }]);
    expect(f.map((x) => x.message)).toEqual(["Rename the file so its content can be identified."]);
  });
  it("FILE-004: duplicate upload", async () => {
    const b = fix("FILE-004/SitePlan.pdf");
    const f = await precheckFiles([{ name: "SitePlan.pdf", bytes: b }, { name: "SitePlan (1).pdf", bytes: b }]);
    expect(f.map((x) => x.message)).toEqual(["Confirm which version should be included."]);
  });
  it("clean PDFs produce nothing", async () => {
    expect(await precheckFiles([{ name: "Site_Plan.pdf", bytes: fix("FILE-006/GaragePlan.pdf") }])).toEqual([]);
  });
});

describe("reviewFiles", () => {
  it("falls back gracefully when the service is down", async () => {
    const r = await reviewFiles(
      [{ name: "scan0004.pdf", bytes: fix("FILE-003/scan0004.pdf") }],
      { application: {} as never, project_attributes: {}, document_hints: {} },
      { fetchImpl: async () => { throw new Error("offline"); } },
    );
    expect(r.visionUnavailable).toBe(true);
    expect(r.findings).toHaveLength(1);
  });
});
