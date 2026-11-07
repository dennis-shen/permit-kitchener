import { describe, expect, it } from "vitest";
import { DISCLAIMER, ReadinessReport, Submission, parseInfoPkgJson, Condition } from "./index";

const s9 = {
  application: {
    application_id: "MOCK-RES-002", applicant_name: "Morgan Patel",
    property_address: "456 Example Avenue, Kitchener", applicant_role: "Property owner",
    project_category: "Residential", project_type: "Deck", project_description: "Construct a rear-yard deck",
    estimated_construction_value: 18000, submission_method: "Online", submission_date: "2026-10-15",
    declaration_completed: true, signature_present: false,
  },
  project_attributes: { deck_height_metres: 0.9, permanent_roof: false, deck_length_metres: 5.5, deck_width_metres: 3.6 },
  documents: [
    { filename: "Application_Form.pdf", document_type: "Application form", present: true, complete: false, issues: ["Applicant signature missing"] },
    { filename: "Site_Plan.pdf", document_type: "Site plan", present: true, complete: false, issues: [] },
    { filename: "Deck_Plan.pdf", document_type: "Construction drawing", present: true, complete: false, issues: [] },
    { filename: "Deck_Side_View.pdf", document_type: "Construction drawing", present: true, complete: false, issues: [] },
  ],
};

describe("schema", () => {
  it("parses InfoPkg §9 JSON verbatim", () => {
    const sub = parseInfoPkgJson(s9);
    expect(sub.application.project_type).toBe("deck_porch");
    expect(sub.documents.map((d) => d.document_type)).toEqual(["application_form", "site_plan", "deck_plan", "deck_side_view"]);
    expect(Submission.parse(sub)).toBeTruthy();
  });

  it("rejects a report that claims approval or alters the disclaimer", () => {
    const base = {
      application_id: "X", project_type: null, permit_required: "unknown", readiness: "more_info_required",
      readiness_label: "More information required", items: [], findings: [], missing_item_count: 0,
      formal_approval: false, disclaimer: DISCLAIMER,
    };
    expect(ReadinessReport.safeParse(base).success).toBe(true);
    expect(ReadinessReport.safeParse({ ...base, formal_approval: true }).success).toBe(false);
    expect(ReadinessReport.safeParse({ ...base, disclaimer: "ok" }).success).toBe(false);
  });

  it("accepts nested conditions", () => {
    expect(Condition.safeParse({ any: [{ fact: "deck_height_metres", gte: 0.61 }, { fact: "permanent_roof", eq: true }] }).success).toBe(true);
  });
});
