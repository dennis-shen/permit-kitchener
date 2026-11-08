import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listSaved, precheckFiles, saveFile } from "./index";

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

describe("saved uploads client", () => {
  it("sends the page's file and parses the saved list", async () => {
    let seen: { url: string; method?: string } | undefined;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen = { url, method: init?.method };
      return new Response(JSON.stringify({ files: [{ page: "deck_plan", file: { id: "x", name: "Deck_Plan.pdf", type: "application/pdf", size: 3, uploaded_at: 1 },
        review: { documents: [{ filename: "Deck_Plan.pdf", document_type: "deck_plan" }], findings: [] } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await saveFile("deck_plan", { name: "Deck_Plan.pdf", bytes: new Uint8Array([1, 2, 3]) },
      { application: {} as never, project_attributes: {}, document_hints: {} }, { fetchImpl });
    expect(seen).toEqual({ url: "/api/files/deck_plan", method: "PUT" });
    expect(r.files[0]?.file.name).toBe("Deck_Plan.pdf");
  });

  it("throws the server's error message", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: "down" }), { status: 503 })) as unknown as typeof fetch;
    await expect(listSaved({ fetchImpl })).rejects.toThrow("down");
  });
});
