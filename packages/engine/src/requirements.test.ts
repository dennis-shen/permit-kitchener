import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ProjectType, RequirementSet } from "@permit/schema";

const directory = new URL("../../../data/requirements/", import.meta.url);
const filenames = readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
const load = (name: string) => RequirementSet.parse(
  JSON.parse(readFileSync(new URL(name, directory), "utf8")),
);
const sets = filenames.map(load);
const requirements = sets.flatMap((set) => set.requirements);
const details = requirements.flatMap((requirement) => requirement.details);
const byId = new Map(details.map((detail) => [detail.id, detail]));

describe("A1 requirement data", () => {
  it("supplies general plus exactly one file per contract project type", () => {
    expect(filenames).toEqual(["general", ...ProjectType.options].map((type) => `${type}.json`).sort());
  });

  it.each(filenames)("validates %s with the frozen Zod contract", (filename) => {
    const set = load(filename);
    expect(filename).toBe(`${set.projectType}.json`);
    expect(set.requirements.length).toBeGreaterThan(0);
    for (const requirement of set.requirements) {
      expect(requirement.infoPkgSection).toBe(set.infoPkgSection);
      expect(requirement.resourceIds.length).toBeGreaterThan(0);
      expect(requirement.plainLanguage.trim()).not.toBe("");
      expect(requirement.missingMessage.trim()).not.toBe("");
      expect(requirement.details.length).toBeGreaterThan(0);
      for (const detail of requirement.details) {
        expect(detail.id.startsWith(`${requirement.id}.`)).toBe(true);
        expect(detail.missingMessage.trim()).not.toBe("");
        expect(detail.whereToAdd.trim()).not.toBe("");
      }
      expect(requirement.links.length).toBeGreaterThan(0);
      for (const l of requirement.links) expect(l.url).toMatch(/^https:\/\//);
    }
  });

  it("rejects malformed detail IDs and unsupported document types", () => {
    const raw = JSON.parse(readFileSync(new URL("deck_porch.json", directory), "utf8"));
    raw.requirements[0].details[0].id = "unstable-id";
    expect(RequirementSet.safeParse(raw).success).toBe(false);
    raw.requirements[0].details[0].id = "deck.site_plan.deck_dimensions";
    raw.requirements[0].documentType = "unrecognized_plan";
    expect(RequirementSet.safeParse(raw).success).toBe(false);
  });

  it("keeps globally unique requirement and detail IDs", () => {
    const ids = [...requirements, ...details].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches every published index row, including its parent and document type", () => {
    const index = readFileSync(new URL("INDEX.md", directory), "utf8");
    const rows = index.split("\n").filter((line) => line.startsWith("| `"));
    const expected = requirements.flatMap((requirement) => requirement.details.map((detail) =>
      `| \`${requirement.id}\` | \`${requirement.documentType}\` | \`${detail.id}\` | ${detail.label} |`,
    ));
    expect(rows.sort()).toEqual(expected.sort());
  });

  it("maps all nine general fields to contract application field names", () => {
    expect(load("general.json").requirements.flatMap((r) => r.details.map((d) => d.id))).toEqual([
      "applicant_name", "property_address", "applicant_role", "project_type", "project_description",
      "estimated_construction_value", "submission_date", "declaration_completed", "signature_present",
    ].map((field) => `general.application.${field}`));
  });

  it("encodes the exact deck and solar trigger boundaries", () => {
    expect(load("deck_porch.json").permitTrigger).toMatchObject({
      projectType: "deck_porch",
      requiredWhen: { any: [
        { fact: "deck_height_metres", gte: 0.61 }, { fact: "permanent_roof", eq: true },
      ] },
    });
    expect(load("solar_panels.json").permitTrigger).toMatchObject({
      projectType: "solar_panels",
      requiredWhen: { all: [
        { fact: "mounted_to_building", eq: true }, { fact: "aggregate_panel_area_m2", gte: 5 },
      ] },
    });
  });

  it.each([
    ["basement.floor_plan.kitchen_bathroom_layout", "has_kitchen_or_bathroom"],
    ["addition.description.mentions_demolition", "removes_existing_exterior_wall"],
    ["solar.structural_review.strengthening_details", "strengthening_required"],
  ])("makes %s conditional on %s", (id, fact) => {
    expect(byId.get(id)?.appliesWhen).toEqual({ fact, eq: true });
  });

  it("keeps the solar strengthening decision unconditional and ICI guidance local", () => {
    expect(byId.get("solar.structural_review.strengthening_required")?.appliesWhen).toBeUndefined();
    expect(byId.get("ici.description.previous_and_proposed_use")?.staffGuidance).toBe(true);
    expect(details.filter((detail) => detail.staffGuidance).map((detail) => detail.id))
      .toEqual(["ici.description.previous_and_proposed_use"]);
  });

  it("reserves the deck's eight separate deficiency IDs without adding a description document", () => {
    const ids = [
      "general.application.signature_present", "deck.site_plan.rear_property_line_distance",
      "deck.site_plan.side_property_line_distance", "deck.site_plan.nearby_structures",
      "deck.plan.beam_size", "deck.plan.joist_size_spacing",
      "deck.side_view.deck_height", "deck.side_view.guard_height",
    ];
    expect(ids.every((id) => byId.has(id))).toBe(true);
    expect(new Set(ids).size).toBe(8);
    expect(load("deck_porch.json").requirements.map((r) => r.documentType))
      .toEqual(["site_plan", "deck_plan", "deck_side_view"]);
  });

  it("only refers to the published resource IDs pending the content owner's registry", () => {
    const allowed = ["building-applications-forms", "residential-permits", "miscellaneous-permits", "ici-permits"];
    expect(requirements.every((r) => r.resourceIds.every((id) => allowed.includes(id)))).toBe(true);
  });
});

// Verbatim InfoPkg §6 feedback: fixtures and copy use these same detail IDs.
const sourceFeedback: Record<string, string> = {
  "general.application.signature_present": "Applicant signature is missing. Sign the applicant declaration before submitting.",
  "basement.floor_plan.window_sizes": "Bedroom window information is incomplete. Add the window dimensions to the floor plan.",
  "basement.floor_plan.ceiling_height": "Ceiling height is missing. Show the basement ceiling height on the drawing.",
  "basement.floor_plan.furnace_location": "Furnace location is missing. Identify the furnace on the basement plan.",
  "basement.floor_plan.overhead_beam": "Existing overhead construction is not identified. Show the location of the existing overhead beam.",
  "deck.site_plan.rear_property_line_distance": "Property-line distances are missing. Add the distance from the deck to the rear and side property lines.",
  "deck.site_plan.side_property_line_distance": "Property-line distances are missing. Add the distance from the deck to the rear and side property lines.",
  "deck.site_plan.nearby_structures": "A nearby structure is not shown. Add the shed to the site plan.",
  "deck.plan.beam_size": "Beam information is incomplete. Identify the proposed beam size.",
  "deck.plan.joist_size_spacing": "Joist information is incomplete. Identify the floor-joist size and spacing.",
  "deck.side_view.deck_height": "The side view is incomplete. Add the deck height and guard height.",
  "deck.side_view.guard_height": "The side view is incomplete. Add the deck height and guard height.",
  "garage.site_plan.property_line_distances": "A property-line measurement is missing. Add the distance from the proposed garage to the side property line.",
  "garage.site_plan.other_structures": "The site plan is incomplete. Show the location of the existing shed.",
  "garage.foundation.slab_detail": "Foundation information is missing. Add the proposed foundation or slab detail.",
  "garage.elevations.building_height": "One elevation is incomplete. Add the proposed garage height.",
  "addition.floor_plan.existing_proposed_distinction": "Existing and proposed work are not clearly differentiated. Use labels, line styles or another clear method to distinguish new construction.",
  "addition.elevations.all_affected_sides": "An exterior elevation is missing. Add the elevation for the affected side of the building.",
  "addition.floor_plan.window_sizes": "Window information is incomplete. Add the proposed window sizes.",
  "addition.roof_plan.existing_new_connection": "The roof connection is unclear. Add a detail showing how the proposed roof connects to the existing building.",
  "addition.description.mentions_demolition": "The project description is incomplete. Update it to include the proposed removal of the existing exterior wall.",
  "solar.structural_review.engineer_review": "Structural review is missing. Add the professional engineer’s review of the existing roof and supporting structure.",
  "solar.roof_plan.roof_member_sizes_spacing": "Existing structural information is missing. Identify the existing roof-member sizes and spacing.",
  "solar.mounting.fastener_sizes_spacing": "Fastening information is incomplete. Provide the proposed fastener sizes and spacing.",
  "solar.roof_plan.support_locations": "Support locations are not shown. Identify where the mounting system connects to the supporting roof elements.",
  "solar.mounting.rail_support_info": "Mounting details are incomplete. Add the rail and support information.",
  "solar.structural_review.strengthening_required": "Strengthening requirements are unclear. Indicate whether supplementary construction is required.",
  "ici.key_plan.unit_location": "Key plan is missing. Add a plan showing the location of the unit within the plaza.",
  "ici.code_matrix.applicable_matrix": "Code matrix is missing. Include the applicable building code matrix.",
  "ici.electrical_plan.plan_content": "Electrical plan is missing. Add the required electrical drawing.",
  "ici.architectural_plan.signature_date": "Architectural plan authentication is incomplete. Add the applicable signature and date.",
  "ici.plumbing_plan.professional_id": "Plumbing-plan information is incomplete. Add the applicable professional or designer identification.",
  "ici.description.previous_and_proposed_use": "Previous use is unclear. Clarify the previous and proposed use so that applicable requirements can be identified."
};

describe("InfoPkg scenario feedback coverage", () => {
  it.each(Object.entries(sourceFeedback))("preserves %s and its exact fallback message", (id, message) => {
    expect(byId.get(id)?.missingMessage).toBe(message);
  });
});
