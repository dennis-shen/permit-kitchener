import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { GENERAL, REQUIREMENT_SETS } from "@permit/engine";
import { DecisionRequest, decide, decisionSchema, questionsForDocument } from "./decisions";

const input = DecisionRequest.parse({
  project_type: "deck_porch",
  document_type: "deck_plan",
  images: ["iVBORw0KGgo="],
});
function mock(output: unknown) {
  return new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text: JSON.stringify(output) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    },
  });
}

describe("visual boolean decisions", () => {
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
