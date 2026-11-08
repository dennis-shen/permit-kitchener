import { describe, expect, it } from "vitest";
import { Submission } from "@permit/schema";
import { buildChecklist, classify, evaluate, permitRequired, unknownProjectReport } from "./index";

describe("permit triggers", () => {
  it("deck: 0.61 m required, 0.60 m not, roof required, unknown height unknown", () => {
    expect(permitRequired("deck_porch", { deck_height_metres: 0.61, permanent_roof: false })).toBe(true);
    expect(permitRequired("deck_porch", { deck_height_metres: 0.6, permanent_roof: false })).toBe(false);
    expect(permitRequired("deck_porch", { deck_height_metres: 0.3, permanent_roof: true })).toBe(true);
    expect(permitRequired("deck_porch", { permanent_roof: false })).toBe("unknown");
  });
  it("solar: 5 m² mounted required, 4.99 not, ground-mounted not", () => {
    expect(permitRequired("solar_panels", { mounted_to_building: true, aggregate_panel_area_m2: 5 })).toBe(true);
    expect(permitRequired("solar_panels", { mounted_to_building: true, aggregate_panel_area_m2: 4.99 })).toBe(false);
    expect(permitRequired("solar_panels", { mounted_to_building: false, aggregate_panel_area_m2: 20 })).toBe(false);
  });
  it("types without a trigger always require a permit; garage needs its answers", () => {
    expect(permitRequired("basement_renovation", {})).toBe(true);
    expect(permitRequired("detached_garage", {})).toBe("unknown");
  });
});

describe("classify", () => {
  it("unknown work → no project type", () => {
    const r = classify({ workKind: "unsure" });
    expect(r.projectType).toBeNull();
    expect(r.permitRequired).toBe("unknown");
  });
  it("low deck may not need a permit", () => {
    const r = classify({ workKind: "deck_or_porch", deckHeightMetres: 0.4, permanentRoof: "no" });
    expect(r.projectType).toBe("deck_porch");
    expect(r.permitRequired).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/Confirm with the City/);
  });
  it("interior alteration in a commercial unit is ICI, change of use is unusual", () => {
    const r = classify({ workKind: "interior_alteration", buildingKind: "commercial_unit", changeOfUse: "yes" });
    expect(r.projectType).toBe("ici_interior_alteration");
    expect(r.unusualAspects).toContain("Change of use");
  });
});

describe("checklist", () => {
  it("hides kitchen/bath layout unless applicable", () => {
    const ids = (a: Record<string, boolean>) =>
      buildChecklist("basement_renovation", a).flatMap((i) => i.details.map((d) => d.id));
    expect(ids({})).not.toContain("basement.floor_plan.kitchen_bathroom_layout");
    expect(ids({ has_kitchen_or_bathroom: true })).toContain("basement.floor_plan.kitchen_bathroom_layout");
  });
  it("always includes application info and resolves City links", () => {
    const c = buildChecklist("deck_porch");
    expect(c[0]?.requirementId).toBe("general.application");
    expect(c.find((i) => i.requirementId === "deck.site_plan")?.resources[0]?.url).toMatch(/^https:\/\/www\.kitchener\.ca/);
  });
});

describe("evaluate", () => {
  const base = Submission.parse({
    application: {
      application_id: "T", applicant_name: "A", property_address: "1 Test St, Kitchener", applicant_role: "Owner",
      project_category: "Residential", project_type: "deck_porch", project_description: "Deck",
      estimated_construction_value: 1, submission_date: "2026-01-01", declaration_completed: true, signature_present: true,
    },
    project_attributes: { deck_height_metres: 0.9 },
    documents: [],
  });
  it("missing documents are reported once each, including the application form PDF", () => {
    const r = evaluate(base);
    expect(r.items.filter((i) => i.status === "missing").map((i) => i.requirementId)).toEqual([
      "general.application", "deck.site_plan", "deck.plan", "deck.side_view",
    ]);
    expect(r.readiness).toBe("action_required");
  });
  it("unusual aspects → staff guidance recommended", () => {
    expect(evaluate({ ...base, flags: { unusual_aspects: ["Heritage"] } }).readiness).toBe("staff_guidance_recommended");
  });
  it("external findings force action required; overrides clear engine findings", () => {
    const full = {
      ...base,
      documents: [
        { filename: "form.pdf", document_type: "application_form" as const, present: true, shown_details: [] },
        { filename: "a.pdf", document_type: "site_plan" as const, present: true, shown_details: ["deck.site_plan.deck_dimensions", "deck.site_plan.deck_location", "deck.site_plan.rear_property_line_distance", "deck.site_plan.side_property_line_distance", "deck.site_plan.nearby_structures"] },
        { filename: "b.pdf", document_type: "deck_plan" as const, present: true, shown_details: ["deck.plan.posts", "deck.plan.joist_size_spacing", "deck.plan.beam_size", "deck.plan.stairs", "deck.plan.landings"] },
        { filename: "c.pdf", document_type: "deck_side_view" as const, present: true, shown_details: ["deck.side_view.deck_height"] },
      ],
    };
    const r = evaluate(full);
    expect(r.findings.map((f) => f.id)).toEqual(["eng:deck.side_view.guard_height"]);
    const overridden = evaluate(full, [{ ...r.findings[0]!, userOverridden: true }]);
    expect(overridden.readiness).toBe("appears_ready");
    const withFile = evaluate(full, [{ ...r.findings[0]!, userOverridden: true }, { id: "v:dup", category: "wrong", severity: "warning", message: "Confirm which version should be included.", evidence: [] }]);
    expect(withFile.readiness).toBe("action_required");
  });
  it("unknown project report", () => expect(unknownProjectReport("X").readiness).toBe("more_info_required"));
});

describe("threshold questions (data-driven)", () => {
  it("deck questions decide whether a permit is required", async () => {
    const { questionsFor, factsFromAnswers, permitRequired, allQuestionsAnswered } = await import("./index");
    expect(questionsFor("deck_porch").map((q) => q.id)).toEqual(["deck_height_metres", "permanent_roof", "multi_unit_or_heritage"]);
    const low = { deck_height_metres: 0.4, permanent_roof: "no", multi_unit_or_heritage: "no" } as const;
    expect(allQuestionsAnswered("deck_porch", low)).toBe(true);
    expect(permitRequired("deck_porch", factsFromAnswers("deck_porch", low))).toBe(false);
    expect(permitRequired("deck_porch", factsFromAnswers("deck_porch", { ...low, permanent_roof: "yes" }))).toBe(true);
    expect(permitRequired("deck_porch", factsFromAnswers("deck_porch", { ...low, deck_height_metres: undefined }))).toBe("unknown");
  });
  it("'yes' to change of use flags staff guidance", async () => {
    const { unusualFromAnswers } = await import("./index");
    expect(unusualFromAnswers("ici_interior_alteration", { change_of_use: "yes" })).toEqual(["Change of use"]);
    expect(unusualFromAnswers("ici_interior_alteration", { change_of_use: "unsure" })).toEqual([]);
  });
  it("search finds projects from the applicant's own words", async () => {
    const { searchProjects } = await import("./index");
    expect(searchProjects("backyard porch")[0]?.type).toBe("deck_porch");
    expect(searchProjects("shed")[0]?.type).toBe("detached_garage");
    expect(searchProjects("turn a store into a café")[0]?.type).toBe("ici_interior_alteration");
    expect(searchProjects("")).toHaveLength(6);
  });
  it("findings say where to add the missing item and link to guidance", async () => {
    const { evaluate } = await import("./index");
    const r = evaluate(Submission.parse({
      application: { application_id: "T", applicant_name: "A", property_address: "1 Test St", applicant_role: "Owner",
        project_category: "Residential", project_type: "deck_porch", project_description: "Deck", estimated_construction_value: 1,
        submission_date: "2026-01-01", declaration_completed: true, signature_present: false },
      project_attributes: { deck_height_metres: 0.9 }, documents: [],
    }));
    const sig = r.findings.find((f) => f.detailId === "general.application.signature_present")!;
    expect(sig.reference?.whereToAdd).toMatch(/Section I/);
    expect(sig.reference?.links?.[0]?.url).toMatch(/ontario\.ca/);
  });
});

describe("one PDF per page", () => {
  it("groups requirements that share a document into one page, in InfoPkg order", async () => {
    const { documentPages } = await import("./index");
    const garage = documentPages("detached_garage");
    expect(garage.map((p) => p.documentType)).toEqual(["application_form", "site_plan", "floor_plan", "foundation_plan", "elevations"]);
    expect(garage[0]!.items.map((i) => i.requirementId)).toEqual(["general.application", "garage.description"]);
    const ici = documentPages("ici_interior_alteration");
    expect(ici[0]!.items.map((i) => i.requirementId)).toEqual(["general.application", "ici.designer"]);
    expect(new Set(ici.map((p) => p.documentType)).size).toBe(ici.length);
  });
  it("a detail shown on a different PDF does not count", async () => {
    const { evaluate } = await import("./index");
    const r = evaluate(Submission.parse({
      application: { application_id: "T", applicant_name: "A B", property_address: "1 Test St", applicant_role: "Owner",
        project_category: "Residential", project_type: "residential_addition", project_description: "Addition", estimated_construction_value: 1,
        submission_date: "2026-01-01", declaration_completed: true, signature_present: true },
      project_attributes: {},
      documents: [{ filename: "roof.pdf", document_type: "roof_plan", present: true, shown_details: ["addition.floor_plan.framing_details"] }],
    }));
    expect(r.items.find((i) => i.requirementId === "addition.floor_plan")?.status).toBe("missing");
  });
  it("garage permit threshold: 108 sq ft or attached", async () => {
    const { permitRequired } = await import("./index");
    expect(permitRequired("detached_garage", { structure_area_m2: 9, attached_to_structure: false })).toBe(false);
    expect(permitRequired("detached_garage", { structure_area_m2: 42, attached_to_structure: false })).toBe(true);
    expect(permitRequired("detached_garage", { structure_area_m2: 9, attached_to_structure: true })).toBe(true);
  });
});
