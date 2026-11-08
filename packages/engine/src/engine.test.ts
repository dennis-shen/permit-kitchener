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

const APP_FIELDS = ["applicant_name", "property_address", "applicant_role", "project_type", "project_description",
  "estimated_construction_value", "submission_date", "declaration_completed", "signature_present"].map((f) => `general.application.${f}`);

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
        { filename: "form.pdf", document_type: "application_form" as const, present: true, shown_details: APP_FIELDS },
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
    expect(searchProjects("")).toHaveLength(7);
  });
  it("findings say where to add the missing item and link to guidance", async () => {
    const { evaluate } = await import("./index");
    const r = evaluate(Submission.parse({
      application: { application_id: "T", applicant_name: "A", property_address: "1 Test St", applicant_role: "Owner",
        project_category: "Residential", project_type: "deck_porch", project_description: "Deck", estimated_construction_value: 1,
        submission_date: "2026-01-01", declaration_completed: true, signature_present: false },
      project_attributes: { deck_height_metres: 0.9 },
      documents: [{ filename: "form.pdf", document_type: "application_form", present: true, shown_details: APP_FIELDS.filter((d) => !d.endsWith("signature_present")) }],
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

describe("application form is checked from its PDF only", () => {
  it("typed application details never tick form fields", async () => {
    const { evaluate } = await import("./index");
    const app = { application_id: "T", applicant_name: "Sam Example", property_address: "1 Test St", applicant_role: "Owner",
      project_category: "Residential" as const, project_type: "basement_renovation" as const, project_description: "Basement",
      estimated_construction_value: 5000, submission_date: "2026-01-01", declaration_completed: true, signature_present: true };
    const r = evaluate(Submission.parse({ application: app, project_attributes: {},
      documents: [{ filename: "form.pdf", document_type: "application_form", present: true, shown_details: [] }] }));
    const item = r.items.find((i) => i.requirementId === "general.application")!;
    expect(item.status).toBe("incomplete");
    expect(item.issues).toHaveLength(9);
  });
});

describe("changing an HVAC system (City page + official forms)", () => {
  const app = { application_id: "T", applicant_name: "Sam Example", property_address: "1 Test St", applicant_role: "Owner",
    project_category: "Residential" as const, project_type: "hvac_system" as const, project_description: "Replace furnace",
    estimated_construction_value: 8000, submission_date: "2026-01-01", declaration_completed: true, signature_present: true };

  it("is in the dropdown, always needs a permit, and has the City's three documents in order", async () => {
    const { documentPages, searchProjects } = await import("./index");
    expect(searchProjects("replace my furnace")[0]?.type).toBe("hvac_system");
    expect(searchProjects("heat pump")[0]?.type).toBe("hvac_system");
    expect(searchProjects("backyard porch").map((o) => o.type)).not.toContain("hvac_system");
    expect(permitRequired("hvac_system", {})).toBe(true);
    const pages = documentPages("hvac_system");
    expect(pages.map((p) => [p.documentType, p.label])).toEqual([
      ["application_form", "Application form"],
      ["designer_schedule", "Schedule 1: Designer information"],
      ["heat_loss_gain", "Heat loss and gain calculations"],
    ]);
    expect(pages[0]!.items.map((i) => i.requirementId)).toEqual([
      "general.application", "hvac.site", "hvac.applicant", "hvac.licensing", "hvac.completeness",
    ]);
  });

  it("owner and builder sections apply only when the answers say so", async () => {
    const { documentPages, factsFromAnswers } = await import("./index");
    const facts = factsFromAnswers("hvac_system", { owner_differs_from_applicant: "yes", builder_known: "yes", multi_unit_or_heritage: "no" });
    expect(documentPages("hvac_system", facts)[0]!.items.map((i) => i.requirementId)).toEqual([
      "general.application", "hvac.site", "hvac.applicant", "hvac.owner", "hvac.builder", "hvac.licensing", "hvac.completeness",
    ]);
  });

  it("placeholder: every field on the uploaded PDFs counts as found → nothing unfinished", async () => {
    const { documentPages } = await import("./index");
    const documents = documentPages("hvac_system").map((p) => ({
      filename: `${p.documentType}.pdf`, document_type: p.documentType, present: true,
      shown_details: p.items.flatMap((i) => i.details.map((d) => d.id)),
    }));
    const r = evaluate(Submission.parse({ application: app, project_attributes: {}, documents }));
    expect(r.findings).toEqual([]);
    expect(r.readiness).toBe("appears_ready");
  });

  it("optional fields (unit number, fax…) are listed but never reported as missing", async () => {
    const { documentPages } = await import("./index");
    const heat = documentPages("hvac_system").find((p) => p.documentType === "heat_loss_gain")!;
    const all = heat.items.flatMap((i) => i.details);
    const required = all.filter((d) => !d.optional).map((d) => d.id);
    expect(all.some((d) => d.optional)).toBe(true);
    const r = evaluate(Submission.parse({ application: app, project_attributes: {},
      documents: [{ filename: "heat.pdf", document_type: "heat_loss_gain", present: true, shown_details: required }] }));
    expect(r.items.filter((i) => i.requirementId.startsWith("hvac.heat_")).every((i) => i.status === "complete")).toBe(true);
    const r2 = evaluate(Submission.parse({ application: app, project_attributes: {},
      documents: [{ filename: "heat.pdf", document_type: "heat_loss_gain", present: true, shown_details: [] }] }));
    const issues = r2.items.filter((i) => i.requirementId.startsWith("hvac.heat_")).flatMap((i) => i.issues.map((x) => x.detailId));
    expect(issues.sort()).toEqual(required.sort());
  });

  it("Schedule 1 and the heat loss summary are recognised from their file names", async () => {
    const { documentTypeFromFilename } = await import("@permit/schema");
    expect(documentTypeFromFilename("Schedule_1_Designer.pdf")).toBe("designer_schedule");
    expect(documentTypeFromFilename("dsd_build_heat_loss_and_gain_calculations_summary.pdf")).toBe("heat_loss_gain");
  });
});

describe("page groups: long forms follow the form's sections", () => {
  it("the application form is grouped by section in form order, even where requirements list fields out of order", async () => {
    const { documentPages, pageGroups } = await import("./index");
    const form = documentPages("deck_porch")[0]!;
    const { intro, groups } = pageGroups(form);
    expect(intro).toMatch(/application form/);
    expect(groups.map((g) => g.title)).toEqual([
      "Section A: Project information", "Section B: Purpose of application", "Section C: Applicant", "Section I: Declaration of applicant",
    ]);
    expect(groups[0]!.detailIds).toEqual(["general.application.property_address", "general.application.estimated_construction_value"]);
    expect(groups.flatMap((g) => g.detailIds).sort()).toEqual(form.items.flatMap((i) => i.details.map((d) => d.id)).sort());
  });

  it("another requirement on the form joins its section; one wholly in a section introduces it", async () => {
    const { documentPages, factsFromAnswers, pageGroups } = await import("./index");
    const garage = pageGroups(documentPages("detached_garage")[0]!).groups;
    expect(garage.find((g) => g.title.startsWith("Section B"))!.detailIds).toContain("garage.description.scope");
    const hvac = pageGroups(documentPages("hvac_system", factsFromAnswers("hvac_system", { owner_differs_from_applicant: "yes" }))[0]!).groups;
    expect(hvac.map((g) => g.title)).toEqual([
      "Application submitted to", "Section A: Project information", "Section B: Purpose of application", "Section C: Applicant",
      "Section D: Owner", "Section F: New home construction licensing", "Section H: Completeness and compliance", "Section I: Declaration of applicant",
    ]);
    expect(hvac.find((g) => g.title === "Section D: Owner")!.intro).toMatch(/owner is not the applicant/);
  });

  it("drawings and single-section documents keep one group per requirement", async () => {
    const { documentPages, pageGroups } = await import("./index");
    const deckPlan = documentPages("deck_porch").find((p) => p.documentType === "deck_plan")!;
    expect(pageGroups(deckPlan)).toEqual({ groups: [expect.objectContaining({ key: "deck.plan", title: "Deck plan view" })] });
    const heat = documentPages("hvac_system").find((p) => p.documentType === "heat_loss_gain")!;
    expect(pageGroups(heat).groups.map((g) => g.key)).toEqual(heat.items.map((i) => i.requirementId));
  });
});
