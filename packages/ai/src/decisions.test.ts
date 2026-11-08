import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { GENERAL, REQUIREMENT_SETS } from "@permit/engine";
import { DecisionRequest, decide, decisionSchema, questionsForDocument } from "./decisions";

const input = DecisionRequest.parse({
  project_type: "deck_porch",
  document_type: "deck_plan",
  images: ["iVBORw0KGgo="],
});
function mock(output: unknown, ...later: unknown[]) {
  const outputs = [output, ...later];
  let call = 0;
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(outputs[call++]) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}

describe("visual boolean decisions", () => {
  it("omits the HVAC House checkbox and scopes heat-summary completion rules", () => {
    const hvac = { ...input, project_type: "hvac_system" as const };
    const form = questionsForDocument({ ...hvac, document_type: "application_form" });
    expect(form["hvac.design_activities.hvac_house"]).toBeUndefined();
    expect(form["hvac.design_activities.work_description"]).toBeTruthy();
    const heat = questionsForDocument({ ...hvac, document_type: "heat_loss_gain" });
    expect(heat["hvac.heat_designer.signature"]).toContain("typed name");
    expect(heat["hvac.heat_designer.signature"]).toContain("name in another field is false");
    expect(heat["hvac.heat_design_conditions.temperature_range"]).toContain("explicit N/A");
    expect(heat["hvac.heat_design_conditions.temperature_range"]).toContain("blank field is false");
    expect(heat["hvac.heat_location.address"]).not.toContain("N/A exception");
  });

  it("builds questions from every requirement JSON and only the current document", () => {
    for (const set of Object.values(REQUIREMENT_SETS)) {
      for (const req of [...GENERAL.requirements, ...set.requirements]) {
        // Cover conditional sections as well as the ordinary project attributes.
        const facts = {
          owner_differs_from_applicant: true,
          builder_known: true,
          removes_existing_exterior_wall: true,
          supplementary_construction_required: true,
        };
        const questions = questionsForDocument({
          ...input,
          project_type: set.projectType as DecisionRequest["project_type"],
          document_type: req.documentType,
          project_attributes: facts,
        });
        for (const id of Object.keys(questions).filter((k) => !k.startsWith("file."))) {
          expect(
            [...GENERAL.requirements, ...set.requirements].some(
              (r) => r.documentType === req.documentType && r.details.some((d) => d.id === id),
            ),
          ).toBe(true);
        }
        if (!req.appliesWhen)
          for (const detail of req.details.filter((d) => !d.appliesWhen)) {
            expect(questions[detail.id]).toBeTruthy();
          }
      }
    }
  });

  it("does not infer fields from typed application details or other documents", () => {
    const q = questionsForDocument(input);
    expect(q["deck.plan.beam_size"]).toBeTruthy();
    expect(q["general.application.signature_present"]).toBeUndefined();
    const form = questionsForDocument({ ...input, document_type: "application_form" });
    expect(form["general.owner.last_name"]).toBeUndefined();
    expect(form["general.applicant.telephone"]).toContain("Telephone");
  });

  it("uses SDK structured outputs and image parts, returning only booleans", async () => {
    const answers = Object.fromEntries(
      Object.keys(questionsForDocument(input)).map((id) => [id, id !== "deck.plan.beam_size"]),
    );
    const model = mock(answers);
    expect(await decide(input, model)).toEqual(answers);
    const call = model.doGenerateCalls[0]!;
    expect(call.responseFormat?.type).toBe("json");
    expect(JSON.stringify(call.responseFormat)).toContain('"additionalProperties":false');
    expect(call.prompt.find((m) => m.role === "user")?.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "file", mediaType: "image/png" })]),
    );
  });

  it("checks BCINs in their own schema and combines only the requested boolean keys", async () => {
    const form = DecisionRequest.parse({
      ...input,
      project_type: "hvac_system",
      document_type: "application_form",
    });
    const id = "hvac.designer_declaration.individual_bcin";
    const keys = Object.keys(questionsForDocument(form));
    const general = Object.fromEntries(
      keys.filter((key) => !key.endsWith("bcin")).map((key) => [key, false]),
    );
    const bcins = Object.fromEntries(
      keys.filter((key) => key.endsWith("bcin")).map((key) => [key, key === id]),
    );
    const predicates = Object.fromEntries(
      Object.entries(bcins).flatMap(([key, value]) => [
        [`${key}.selection`, value],
        [`${key}.location`, value],
        [`${key}.number`, value],
      ]),
    );
    const model = mock(general, predicates);
    expect(await decide(form, model)).toEqual({ ...general, ...bcins });
    expect(model.doGenerateCalls).toHaveLength(2);
    const format = model.doGenerateCalls[1]!.responseFormat;
    expect(format?.type).toBe("json");
    if (format?.type === "json") expect(format.schema?.required).toEqual(Object.keys(predicates));
    const focused = model.doGenerateCalls[1]!.prompt.find((m) => m.role === "user");
    expect(focused?.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "file", mediaType: "image/png" })]),
    );
  });

  it.each([
    [false, true, true],
    [true, false, true],
    [true, true, false],
  ])(
    "requires the BCIN choice, location and numeric format",
    async (selection, location, number) => {
      const form = DecisionRequest.parse({
        ...input,
        project_type: "hvac_system",
        document_type: "application_form",
      });
      const general = Object.fromEntries(
        Object.keys(questionsForDocument(form))
          .filter((id) => !id.endsWith("bcin"))
          .map((id) => [id, false]),
      );
      const id = "hvac.designer_declaration.individual_bcin";
      const predicates = {
        [`${id}.selection`]: selection,
        [`${id}.location`]: location,
        [`${id}.number`]: number,
        "hvac.designer_declaration.firm_bcin.selection": false,
        "hvac.designer_declaration.firm_bcin.location": false,
        "hvac.designer_declaration.firm_bcin.number": false,
      };
      const result = await decide(form, mock(general, predicates));
      expect(result[id]).toBe(false);
      expect(Object.keys(result)).toEqual(Object.keys(questionsForDocument(form)));
      expect(Object.values(result).every((value) => typeof value === "boolean")).toBe(true);
    },
  );

  it.each([
    {},
    {
      "hvac.designer_declaration.individual_bcin.selection": true,
      "hvac.designer_declaration.individual_bcin.location": true,
      "hvac.designer_declaration.individual_bcin.number": "true",
      "hvac.designer_declaration.firm_bcin.selection": false,
      "hvac.designer_declaration.firm_bcin.location": false,
      "hvac.designer_declaration.firm_bcin.number": false,
    },
  ])(
    "discards initial positives if focused BCIN decisions are incomplete or malformed",
    async (bad) => {
      const form = DecisionRequest.parse({
        ...input,
        project_type: "hvac_system",
        document_type: "application_form",
      });
      const general = Object.fromEntries(
        Object.keys(questionsForDocument(form))
          .filter((id) => !id.endsWith("bcin"))
          .map((id) => [id, true]),
      );
      await expect(decide(form, mock(general, bad))).rejects.toThrow();
    },
  );

  it.each([
    { "deck.plan.beam_size": "true" },
    { "deck.plan.beam_size": true, phone_number: "555-0100" },
    {},
  ])("rejects partial responses, extracted values and string booleans", async (bad) => {
    await expect(decide(input, mock(bad))).rejects.toThrow();
  });

  it("rejects extra keys even if all requested decisions are present", () => {
    const answers = Object.fromEntries(
      Object.keys(questionsForDocument(input)).map((id) => [id, true]),
    );
    expect(
      decisionSchema(questionsForDocument(input)).safeParse({ ...answers, quote: "private" })
        .success,
    ).toBe(false);
  });
});
