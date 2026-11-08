"""Builds data/scenarios/*.json from InfoPkg §6–7. Re-run after editing requirements.

For each document, shown_details = every detail of the requirements whose primary document
type matches, plus explicit extras, minus the scenario's "deliberately missing" items.
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
REQ = ROOT / "data/requirements"

def details_for(ptype, doc_type):
    out = []
    for f in ("general", ptype):
        for r in json.loads((REQ / f"{f}.json").read_text())["requirements"]:
            if r["documentType"] == doc_type:
                out += [d["id"] for d in r["details"]]
    return out

def doc(ptype, filename, dtype, present=True, missing=(), extra=()):
    shown = [] if not present else [d for d in details_for(ptype, dtype) + list(extra) if d not in missing]
    return {"filename": filename, "document_type": dtype, "present": present, "shown_details": shown}

def app(id_, name, addr, role, ptype, cat, desc, value, date, signed, org=None):
    a = {"application_id": id_, "applicant_name": name, "property_address": addr, "applicant_role": role,
         "project_category": cat, "project_type": ptype, "project_description": desc,
         "estimated_construction_value": value, "submission_method": "Online", "submission_date": date,
         "declaration_completed": True, "signature_present": signed}
    if org: a["applicant_organisation"] = org
    return a

S = []
P = "basement_renovation"
S.append({"title": "Basement renovation",
  "application": app("MOCK-RES-001", "Jordan Lee", "123 Sample Street, Kitchener", "Property owner", P, "Residential",
    "Finish an unfinished basement to add a recreation room, bathroom and bedroom", 42000, "2026-10-15", True),
  "project_attributes": {"has_kitchen_or_bathroom": True},
  "documents": [doc(P, "Application_Form.pdf", "application_form"),
    doc(P, "Basement_Floor_Plan.pdf", "floor_plan", missing=["basement.floor_plan.window_sizes", "basement.floor_plan.ceiling_height", "basement.floor_plan.furnace_location", "basement.floor_plan.overhead_beam"]),
    doc(P, "Plumbing_Sketch.pdf", "plumbing_plan"),
    doc(P, "Project_Description.pdf", "project_description")],
  "expected": {"readiness": "action_required", "missing_item_count": 4, "messages": [
    "Bedroom window information is incomplete. Add the window dimensions to the floor plan.",
    "Ceiling height is missing. Show the basement ceiling height on the drawing.",
    "Furnace location is missing. Identify the furnace on the basement plan.",
    "Existing overhead construction is not identified. Show the location of the existing overhead beam."]}})

P = "deck_porch"
S.append({"title": "Residential deck",
  "application": app("MOCK-RES-002", "Morgan Patel", "456 Example Avenue, Kitchener", "Property owner", P, "Residential",
    "Construct a rear-yard deck", 18000, "2026-10-15", False),
  "project_attributes": {"deck_height_metres": 0.9, "permanent_roof": False, "deck_length_metres": 5.5, "deck_width_metres": 3.6},
  "documents": [doc(P, "Application_Form.pdf", "application_form"),
    doc(P, "Site_Plan.pdf", "site_plan", missing=["deck.site_plan.rear_property_line_distance", "deck.site_plan.side_property_line_distance", "deck.site_plan.nearby_structures"]),
    doc(P, "Deck_Plan.pdf", "deck_plan", missing=["deck.plan.beam_size", "deck.plan.joist_size_spacing"]),
    doc(P, "Deck_Side_View.pdf", "deck_side_view", missing=["deck.side_view.deck_height", "deck.side_view.guard_height"])],
  "expected": {"readiness": "action_required", "missing_item_count": 8, "messages": [
    "Applicant signature is missing. Sign the applicant declaration before submitting.",
    "Property-line distances are missing. Add the distance from the deck to the rear and side property lines.",
    "A nearby structure is not shown. Add the shed to the site plan.",
    "Beam information is incomplete. Identify the proposed beam size.",
    "Joist information is incomplete. Identify the floor-joist size and spacing.",
    "The side view is incomplete. Add the deck height and guard height."]}})

P = "detached_garage"
S.append({"title": "Detached garage",
  "application": app("MOCK-RES-003", "Avery Robinson", "789 Prototype Crescent, Kitchener", "Property owner", P, "Residential",
    "Construct a 6 m by 7 m detached garage", 58000, "2026-10-16", True),
  "project_attributes": {"structure_length_metres": 7, "structure_width_metres": 6, "structure_area_m2": 42, "attached_to_structure": False},
  "documents": [doc(P, "Application_Form.pdf", "application_form"),
    doc(P, "Garage_Site_Plan.pdf", "site_plan", missing=["garage.site_plan.property_line_distances", "garage.site_plan.other_structures"]),
    doc(P, "Garage_Floor_Plan.pdf", "floor_plan"),
    doc(P, "Garage_Elevations.pdf", "elevations", missing=["garage.elevations.building_height"]),
    doc(P, "Foundation_Detail.pdf", "foundation_plan", present=False)],
  "expected": {"readiness": "action_required", "missing_item_count": 4, "messages": [
    "A property-line measurement is missing. Add the distance from the proposed garage to the side property line.",
    "The site plan is incomplete. Show the location of the existing shed.",
    "Foundation information is missing. Add the proposed foundation or slab detail.",
    "One elevation is incomplete. Add the proposed garage height."]}})

P = "residential_addition"
S.append({"title": "Residential addition",
  "application": app("MOCK-RES-004", "Casey Martin", "321 Demonstration Drive, Kitchener", "Property owner", P, "Residential",
    "One-storey rear addition (32 square metres) for a kitchen and dining-room expansion", 145000, "2026-10-16", True),
  "project_attributes": {"addition_area_m2": 32, "removes_existing_exterior_wall": True},
  "documents": [doc(P, "Application_Form.pdf", "application_form"),
    doc(P, "Project_Description.pdf", "project_description", missing=["addition.description.mentions_demolition"]),
    doc(P, "Site_Plan.pdf", "site_plan"),
    doc(P, "Existing_Floor_Plan.pdf", "existing_floor_plan"),
    doc(P, "Proposed_Floor_Plan.pdf", "proposed_floor_plan", missing=["addition.floor_plan.existing_proposed_distinction", "addition.floor_plan.window_sizes"]),
    doc(P, "Foundation_Plan.pdf", "foundation_plan"),
    doc(P, "Roof_Plan.pdf", "roof_plan", missing=["addition.roof_plan.existing_new_connection"]),
    doc(P, "Building_Elevations.pdf", "elevations", missing=["addition.elevations.all_affected_sides"])],
  "expected": {"readiness": "action_required", "missing_item_count": 5, "messages": [
    "The project description is incomplete. Update it to include the proposed removal of the existing exterior wall.",
    "Existing and proposed work are not clearly differentiated. Use labels, line styles or another clear method to distinguish new construction.",
    "Window information is incomplete. Add the proposed window sizes.",
    "The roof connection is unclear. Add a detail showing how the proposed roof connects to the existing building.",
    "An exterior elevation is missing. Add the elevation for the affected side of the building."]}})

P = "solar_panels"
S.append({"title": "Rooftop solar panels",
  "application": app("MOCK-MISC-001", "Taylor Chen", "654 Learning Lane, Kitchener", "Property owner", P, "Miscellaneous",
    "Install rooftop solar panels (18 square metres) on a detached house", 31000, "2026-10-16", True),
  "project_attributes": {"aggregate_panel_area_m2": 18, "mounted_to_building": True},
  "documents": [doc(P, "Application_Form.pdf", "application_form"),
    doc(P, "Solar_Roof_Plan.pdf", "solar_roof_plan", missing=["solar.roof_plan.roof_member_sizes_spacing", "solar.roof_plan.support_locations"]),
    doc(P, "Panel_Specifications.pdf", "panel_spec"),
    doc(P, "Mounting_System.pdf", "mounting_system_spec", missing=["solar.mounting.fastener_sizes_spacing", "solar.mounting.rail_support_info"]),
    doc(P, "Structural_Review.pdf", "structural_review", present=False)],
  "expected": {"readiness": "action_required", "missing_item_count": 6, "messages": [
    "Existing structural information is missing. Identify the existing roof-member sizes and spacing.",
    "Support locations are not shown. Identify where the mounting system connects to the supporting roof elements.",
    "Structural review is missing. Add the professional engineer’s review of the existing roof and supporting structure.",
    "Strengthening requirements are unclear. Indicate whether supplementary construction is required.",
    "Fastening information is incomplete. Provide the proposed fastener sizes and spacing.",
    "Mounting details are incomplete. Add the rail and support information."]}})

P = "ici_interior_alteration"
S.append({"title": "Commercial interior alteration",
  "application": app("MOCK-ICI-001", "Riley Thompson", "Unit 4, 100 Demo Plaza, Kitchener", "Tenant", P, "ICI",
    "Convert a vacant retail unit into a café", 275000, "2026-10-16", True, org="Sample Café Inc."),
  "project_attributes": {},
  "documents": [doc(P, "Application_Form.pdf", "application_form"),
    doc(P, "Project_Description.pdf", "project_description", missing=["ici.description.previous_and_proposed_use"]),
    doc(P, "Architectural_Plan.pdf", "architectural_plan", missing=["ici.architectural_plan.signature_date"]),
    doc(P, "Mechanical_Plan.pdf", "hvac_plan"),
    doc(P, "Equipment_Layout.pdf", "equipment_layout"),
    doc(P, "Plumbing_Plan.pdf", "plumbing_plan", missing=["ici.plumbing_plan.professional_id"]),
    doc(P, "Electrical_Plan.pdf", "electrical_plan", present=False),
    doc(P, "Code_Matrix.pdf", "code_matrix", present=False),
    doc(P, "Key_Plan.pdf", "key_plan", present=False)],
  "expected": {"readiness": "action_required", "missing_item_count": 6, "messages": [
    "Previous use is unclear. Clarify the previous and proposed use so that applicable requirements can be identified.",
    "Code matrix is missing. Include the applicable building code matrix.",
    "Key plan is missing. Add a plan showing the location of the unit within the plaza.",
    "Architectural plan authentication is incomplete. Add the applicable signature and date.",
    "Plumbing-plan information is incomplete. Add the applicable professional or designer identification.",
    "Electrical plan is missing. Add the required electrical drawing."]}})

P = "deck_porch"
S.append({"title": "Complete deck (control)",
  "application": app("MOCK-CONTROL-001", "Jamie Wilson", "987 Test Case Court, Kitchener", "Property owner", P, "Residential",
    "Construct a rear-yard deck", 16000, "2026-10-16", True),
  "project_attributes": {"deck_height_metres": 0.75, "permanent_roof": False},
  "documents": [doc(P, "Application_Form.pdf", "application_form"), doc(P, "Site_Plan.pdf", "site_plan"),
    doc(P, "Deck_Plan.pdf", "deck_plan"), doc(P, "Deck_Side_View.pdf", "deck_side_view")],
  "expected": {"readiness": "appears_ready", "missing_item_count": 0, "messages": []}})

# The synthetic application form shows every field, except a signature/declaration the scenario says is absent.
for s in S:
    a = s["application"]
    for d in s["documents"]:
        if d["document_type"] == "application_form":
            if not a["signature_present"]:
                d["shown_details"].remove("general.application.signature_present")
            if not a["declaration_completed"]:
                d["shown_details"].remove("general.application.declaration_completed")

out = ROOT / "data/scenarios"
for f in out.glob("*.json"): f.unlink()
for s in S:
    s["flags"] = {"unusual_aspects": []}
    (out / f"{s['application']['application_id']}.json").write_text(json.dumps(s, indent=2, ensure_ascii=False) + "\n")
print(f"wrote {len(S)} scenarios")
