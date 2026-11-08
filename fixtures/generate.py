"""Synthetic drawing generator — builds realistic-looking (but fictional) permit drawings.

For every scenario in data/scenarios, each present document is drawn as a sheet with a
title block, simple geometry, and an annotation for each detail it *shows*. Details the
scenario deliberately omits are either left out or drawn without the needed value
(e.g. "GUARD" with no height), so the reviewer must read values, not just labels.

Outputs (deterministic):
  fixtures/drawings/vector/<APP-ID>/<file>.pdf     vector PDFs
  fixtures/files/FILE-00x/...                       InfoPkg §8 file-validation cases
  fixtures/inconsistent/...                         cross-document mismatch cases
  apps/web/public/demo/<APP-ID>/<file>.pdf          copies for the web demo

Run: python fixtures/generate.py   (needs pymupdf, pikepdf, python-docx)
"""
from __future__ import annotations

import io
import json
import pathlib
import random
import shutil
import zlib

import pymupdf as fitz

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "fixtures"
W, H = 792, 612  # letter landscape, points

# Annotation text for every detail when shown.
ANNOT: dict[str, list[str]] = {
    "basement.description.scope": ["SCOPE: Finish the unfinished basement."],
    "basement.floor_plan.room_names": ["RECREATION ROOM", "BEDROOM", "BATHROOM"],
    "basement.floor_plan.window_sizes": ["BEDROOM WINDOW 900 x 600"],
    "basement.floor_plan.door_sizes": ["DOORS 810 x 2030"],
    "basement.floor_plan.kitchen_bathroom_layout": ["TOILET", "VANITY", "SHOWER"],
    "basement.floor_plan.stairs_location": ["STAIRS UP"],
    "basement.floor_plan.furnace_location": ["FURNACE"],
    "basement.floor_plan.new_wall_construction": ["NEW PARTITION WALLS: 2x4 STUDS @ 16\" O.C."],
    "basement.floor_plan.overhead_beam": ["EXISTING OVERHEAD BEAM ABOVE"],
    "basement.floor_plan.ceiling_height": ["CEILING HEIGHT 2.1 m"],
    "deck.site_plan.deck_dimensions": ["DECK 5.5 m x 3.6 m"],
    "deck.site_plan.deck_location": ["PROPOSED DECK", "EXISTING HOUSE"],
    "deck.site_plan.rear_property_line_distance": ["REAR PROPERTY LINE 7.5 m"],
    "deck.site_plan.side_property_line_distance": ["SIDE PROPERTY LINE 1.8 m"],
    "deck.site_plan.nearby_structures": ["EXISTING SHED", "EXISTING POOL"],
    "deck.plan.posts": ["6x6 POSTS"],
    "deck.plan.joist_size_spacing": ["JOISTS 2x8 @ 16\" O.C."],
    "deck.plan.beam_size": ["BEAM 3-2x10 BUILT-UP"],
    "deck.plan.stairs": ["STAIRS"],
    "deck.plan.landings": ["LANDING"],
    "deck.side_view.deck_height": ["DECK HEIGHT {deck_height} m"],
    "deck.side_view.guard_height": ["GUARD HEIGHT 1.07 m"],
    "garage.description.scope": [],  # the application form description says "garage"
    "garage.site_plan.structure_dimensions": ["GARAGE 6 m x 7 m"],
    "garage.site_plan.property_line_distances": ["REAR PROPERTY LINE 3.0 m", "LEFT SIDE PROPERTY LINE 1.2 m", "RIGHT SIDE PROPERTY LINE 9.5 m"],
    "garage.site_plan.other_structures": ["EXISTING SHED"],
    "garage.floor_plan.construction_details": ["WALLS: 2x6 STUDS @ 16\" O.C."],
    "garage.foundation.slab_detail": ["100 mm FLOATING SLAB"],
    "garage.elevations.all_sides": [],  # drawn as four elevation views
    "garage.elevations.building_height": [],
    "addition.description.scope": ["SCOPE: One-storey rear addition, 32 m2."],
    "addition.description.mentions_demolition": ["Includes removal of the existing exterior wall."],
    "addition.site_plan.addition_location": ["PROPOSED ADDITION", "EXISTING HOUSE"],
    "addition.existing_floor_plan.existing_layout": ["EXISTING KITCHEN", "EXISTING DINING"],
    "addition.floor_plan.proposed_layout": ["NEW KITCHEN", "NEW DINING"],
    "addition.floor_plan.existing_proposed_distinction": ["LEGEND: EXISTING TO REMAIN (DASHED) / NEW CONSTRUCTION (SOLID)"],
    "addition.floor_plan.window_sizes": ["WINDOW 1200 x 1500"],
    "addition.foundation.foundation_details": ["FOOTING 600 x 200", "FOUNDATION WALL 200 mm"],
    "addition.floor_plan.framing_details": ["FLOOR JOISTS 2x10 @ 16\" O.C."],
    "addition.roof_plan.roof_layout": ["ROOF SLOPE 4:12"],
    "addition.roof_plan.existing_new_connection": ["ROOF TIE-IN TO EXISTING (SEE DETAIL 3)"],
    "addition.elevations.all_affected_sides": [],
    "addition.foundation.construction_details": ["WALL SECTION A"],
    "solar.roof_plan.panel_locations": ["PANEL ARRAY (18 m2)"],
    "solar.roof_plan.roof_member_sizes_spacing": ["EXISTING RAFTERS 2x6 @ 16\" O.C."],
    "solar.roof_plan.support_locations": ["ATTACHMENT POINTS AT RAFTERS"],
    "solar.structural_review.engineer_review": ["Reviewed by Professional Engineer"],
    "solar.structural_review.strengthening_required": ["Strengthening not required"],
    "solar.mounting.mounting_details": ["MOUNTING FOOT DETAIL"],
    "solar.mounting.fastener_sizes_spacing": ["5/16\" LAG SCREWS @ 1200 mm O.C."],
    "solar.mounting.rail_support_info": ["RAIL SPAN 1.2 m"],
    "solar.mounting.system_specifications": ["MOUNTING SYSTEM: SAMPLERACK SR-100"],
    "solar.panel_spec.manufacturer_specifications": ["MANUFACTURER: DEMO SOLAR", "MODEL NO. DS-400"],
    "ici.description.previous_and_proposed_use": ["PREVIOUS USE: Retail store", "PROPOSED USE: Cafe (restaurant)"],
    "ici.code_matrix.applicable_matrix": ["OBC DATA MATRIX"],
    "ici.designer.professional_id": ["DESIGNER: Sample Design Co.  BCIN 10001"],
    "ici.key_plan.unit_location": ["KEY PLAN - UNIT 4"],
}
for disc, title in (("architectural_plan", "ARCHITECTURAL FLOOR PLAN"), ("plumbing_plan", "PLUMBING PLAN"),
                    ("hvac_plan", "HVAC / MECHANICAL PLAN"), ("electrical_plan", "ELECTRICAL LIGHTING PLAN")):
    ANNOT[f"ici.{disc}.plan_content"] = [title]
    ANNOT[f"ici.{disc}.professional_id"] = ["DESIGNER BCIN: 10001"]
    ANNOT[f"ici.{disc}.professional_stamp"] = []  # drawn as a circular seal
    ANNOT[f"ici.{disc}.signature_date"] = []  # drawn as ink in the signature box + date

# What to draw when a measurement detail is deliberately missing (label without value).
MISSING_STUB = {
    "deck.site_plan.rear_property_line_distance": "REAR PROPERTY LINE",
    "deck.site_plan.side_property_line_distance": "SIDE PROPERTY LINE",
    "deck.plan.beam_size": "BEAM",
    "deck.plan.joist_size_spacing": "FLOOR JOIST DIRECTION",
    "deck.side_view.guard_height": "GUARD",
    "basement.floor_plan.window_sizes": "BEDROOM WINDOW",
    "addition.floor_plan.window_sizes": "NEW WINDOWS",
    "solar.mounting.rail_support_info": "RAILS",
    "garage.site_plan.property_line_distances": None,  # handled: one side dimension dropped
}

TITLES = {
    "application_form": "APPLICATION FOR A PERMIT TO CONSTRUCT",
    "project_description": "PROJECT DESCRIPTION",
    "site_plan": "SITE PLAN", "floor_plan": "FLOOR PLAN", "existing_floor_plan": "EXISTING FLOOR PLAN",
    "proposed_floor_plan": "PROPOSED FLOOR PLAN", "foundation_plan": "FOUNDATION PLAN", "roof_plan": "ROOF PLAN",
    "elevations": "ELEVATIONS", "deck_plan": "DECK PLAN", "deck_side_view": "DECK SIDE VIEW",
    "key_plan": "KEY PLAN", "architectural_plan": "ARCHITECTURAL PLAN", "plumbing_plan": "PLUMBING PLAN",
    "hvac_plan": "MECHANICAL PLAN", "electrical_plan": "ELECTRICAL PLAN", "equipment_layout": "EQUIPMENT LAYOUT",
    "code_matrix": "CODE MATRIX", "structural_review": "STRUCTURAL REVIEW", "mounting_system_spec": "MOUNTING SYSTEM",
    "panel_spec": "PANEL SPECIFICATIONS", "solar_roof_plan": "SOLAR ROOF PLAN", "sections_details": "SECTIONS",
}

PROJECT_LABELS = {
    "basement_renovation": "Basement renovation", "deck_porch": "Deck or porch", "detached_garage": "Detached garage",
    "residential_addition": "Residential addition", "solar_panels": "Solar panel installation",
    "ici_interior_alteration": "Commercial interior alteration",
}

PROFESSIONAL = {"architectural_plan", "plumbing_plan", "hvac_plan", "electrical_plan", "structural_review"}


def scribble(page: fitz.Page, rect: fitz.Rect, seed: int) -> None:
    rnd = random.Random(seed)
    pts = [fitz.Point(rect.x0 + 6 + i * (rect.width - 12) / 14, rect.y0 + rect.height / 2 + rnd.uniform(-8, 8)) for i in range(15)]
    page.draw_polyline(pts, color=(0.05, 0.05, 0.4), width=1.6)


def title_block(page, title: str, address: str, sheet: str, *, signature_box: bool, signed: bool, dated: bool, seed: int):
    tb = fitz.Rect(W - 250, H - 150, W - 20, H - 20)
    page.draw_rect(tb, color=(0, 0, 0), width=1)
    page.insert_text((tb.x0 + 8, tb.y0 + 16), f"DRAWING: {title}", fontsize=9, fontname="hebo")
    page.insert_text((tb.x0 + 8, tb.y0 + 30), f"ADDRESS: {address}", fontsize=7)
    page.insert_text((tb.x0 + 8, tb.y0 + 42), f"SHEET: {sheet}   SCALE: 1:50", fontsize=7)
    page.insert_text((tb.x0 + 8, tb.y0 + 54), "PREPARED FOR COMMUNIHACKS - SYNTHETIC DATA", fontsize=6)
    if signature_box:
        sb = fitz.Rect(tb.x0 + 8, tb.y0 + 70, tb.x0 + 150, tb.y0 + 110)
        page.insert_text((sb.x0, sb.y0 - 3), "SIGNATURE", fontsize=7)
        page.draw_rect(sb, color=(0, 0, 0), width=0.6)
        if signed:
            scribble(page, sb, seed)
        page.insert_text((sb.x0, sb.y1 + 10), "DATE: 2026-10-10" if dated else "DATE:", fontsize=7)


def stamp(page, seed: int):
    c = fitz.Point(W - 300, H - 85)
    page.draw_circle(c, 32, color=(0.6, 0, 0), width=2)
    page.draw_circle(c, 26, color=(0.6, 0, 0), width=1)
    page.insert_text((c.x - 22, c.y + 3), "LICENSED", fontsize=7, color=(0.6, 0, 0))


def geometry(page, dtype: str, seed: int):
    rnd = random.Random(seed)
    g = fitz.Rect(60, 70, 480, 440)
    if dtype in {"application_form", "project_description", "code_matrix", "structural_review", "panel_spec", "mounting_system_spec", "elevations"}:
        return
    page.draw_rect(g, color=(0, 0, 0), width=1.2)
    for _ in range(4):  # rooms / members
        x = rnd.uniform(g.x0 + 40, g.x1 - 40)
        page.draw_line((x, g.y0), (x, g.y1), color=(0.2, 0.2, 0.2), width=0.8)
    for i in range(3):  # dimension strings
        y = g.y1 + 14 + i * 8
        page.draw_line((g.x0, y), (g.x1, y), color=(0.3, 0.3, 0.3), width=0.4)


def draw_elevations(page, dtype, shown, scenario):
    """Four (or three) elevation views each with an optional height."""
    sides = ["NORTH", "SOUTH", "EAST", "WEST"]
    all_id = "garage.elevations.all_sides" if scenario["application"]["project_type"] == "detached_garage" else "addition.elevations.all_affected_sides"
    if all_id not in shown:
        sides = sides[:3]
    heights = scenario["application"]["project_type"] == "detached_garage"
    height_ok = "garage.elevations.building_height" in shown
    for i, s in enumerate(sides):
        x, y = 60 + (i % 2) * 220, 80 + (i // 2) * 190
        page.draw_rect(fitz.Rect(x, y + 40, x + 180, y + 150), color=(0, 0, 0), width=1)
        page.draw_polyline([fitz.Point(x, y + 40), fitz.Point(x + 90, y), fitz.Point(x + 180, y + 40)], color=(0, 0, 0), width=1)
        page.insert_text((x, y + 168), f"{s} ELEVATION", fontsize=8, fontname="hebo")
        if heights and (height_ok or i < len(sides) - 1):
            page.insert_text((x + 100, y + 168), "HEIGHT 4.6 m", fontsize=7)


def make_page(doc, scenario, d, *, address_override=None, title_override=None):
    app = scenario["application"]
    dtype, shown = d["document_type"], set(d["shown_details"])
    seed = zlib.crc32(f"{app['application_id']}/{d['filename']}".encode()) % 10_000
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 50), title_override or TITLES.get(dtype, dtype.upper()), fontsize=16, fontname="hebo")
    geometry(page, dtype, seed)

    lines: list[str] = []
    if dtype == "application_form":
        lines += [f"Applicant: {app['applicant_name']}", f"Applicant role: {app['applicant_role']}",
                  f"Project type: {PROJECT_LABELS[app['project_type']]}",
                  f"Property address: {app['property_address']}", f"Project description: {app['project_description']}",
                  f"Estimated construction value: ${app['estimated_construction_value']:,}",
                  f"Application date: {app['submission_date']}",
                  "Declaration: [X] I declare the information is true." if app["declaration_completed"] else "Declaration: [ ]"]
    attrs = scenario.get("project_attributes", {})
    for det in d["shown_details"]:
        for t in ANNOT.get(det, []):
            lines.append(t.format(deck_height=attrs.get("deck_height_metres", "")))
    # labels without values for deliberately missing measurements
    pt = app["project_type"]
    req_details = [x for x in DETAILS[pt] if x[1] == dtype]
    for det_id, _ in req_details:
        if det_id not in shown and MISSING_STUB.get(det_id):
            lines.append(MISSING_STUB[det_id])
    if dtype == "site_plan" and pt == "detached_garage" and "garage.site_plan.property_line_distances" not in shown:
        lines += ["REAR PROPERTY LINE 3.0 m", "LEFT SIDE PROPERTY LINE 1.2 m", "RIGHT SIDE PROPERTY LINE"]
    if dtype == "site_plan" and pt == "deck_porch":
        lines.append("EXISTING HOUSE")
    if dtype == "proposed_floor_plan" and attrs.get("removes_existing_exterior_wall"):
        lines.append("REMOVE EXISTING EXTERIOR WALL")
    if dtype in ("elevations",):
        draw_elevations(page, dtype, shown, scenario)

    y = 90
    x = 500 if dtype not in {"application_form", "project_description", "code_matrix", "structural_review", "panel_spec", "mounting_system_spec"} else 70
    for t in dict.fromkeys(lines):
        page.insert_text((x, y), t, fontsize=9)
        y += 16

    # Signature on the application form is the applicant's; on professional drawings it is the designer's.
    if dtype == "application_form":
        sb = fitz.Rect(70, 430, 260, 470)
        page.insert_text((70, 425), "Applicant signature", fontsize=8)
        page.draw_rect(sb, color=(0, 0, 0), width=0.6)
        if app["signature_present"]:
            scribble(page, sb, seed)
    prof = dtype in PROFESSIONAL
    disc_sig = f"ici.{dtype}.signature_date"
    signed = disc_sig in shown if pt == "ici_interior_alteration" and prof else True
    title_block(page, title_override or TITLES.get(dtype, dtype.upper()), address_override or app["property_address"],
                f"A-{seed % 9 + 1}", signature_box=prof, signed=signed, dated=signed, seed=seed)
    if prof and (f"ici.{dtype}.professional_stamp" in shown or pt != "ici_interior_alteration"):
        stamp(page, seed)
    return page


def load_details():
    out = {}
    for f in (ROOT / "data/requirements").glob("*.json"):
        d = json.loads(f.read_text())
        rows = [(x["id"], r["documentType"]) for r in d["requirements"] for x in r["details"]]
        out[d["projectType"]] = rows
    return out


DETAILS = load_details()


def write(path: pathlib.Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def build_doc(scenario, d, **kw) -> bytes:
    doc = fitz.open()
    make_page(doc, scenario, d, **kw)
    doc.set_metadata({"title": d["filename"], "producer": "PermitReady synthetic generator", "creationDate": "D:20261010000000"})
    return doc.tobytes(garbage=3, deflate=True)


def main():
    for sub in ("drawings", "files", "inconsistent"):
        shutil.rmtree(OUT / sub, ignore_errors=True)
    demo = ROOT / "apps/web/public/demo"
    shutil.rmtree(demo, ignore_errors=True)
    scenarios = [json.loads(p.read_text()) for p in sorted((ROOT / "data/scenarios").glob("*.json"))]
    for s in scenarios:
        aid = s["application"]["application_id"]
        for i, d in enumerate(s["documents"]):
            if not d["present"]:
                continue
            pdf = build_doc(s, d)
            write(OUT / "drawings/vector" / aid / d["filename"], pdf)
            write(demo / aid / d["filename"], pdf)
            (OUT / "drawings/vector" / aid / (d["filename"] + ".truth.json")).write_text(json.dumps(
                {"document_type": d["document_type"], "shown_details": d["shown_details"]}, indent=2) + "\n")

    # InfoPkg §8 file-validation cases (in the context of a fictional garage application).
    garage = next(s for s in scenarios if s["application"]["application_id"] == "MOCK-RES-003")
    site = next(d for d in garage["documents"] if d["document_type"] == "site_plan")
    fp = next(d for d in garage["documents"] if d["document_type"] == "floor_plan")
    f = OUT / "files"
    import docx  # python-docx

    dd = docx.Document(); dd.add_paragraph("FLOOR PLAN (synthetic)"); b = io.BytesIO(); dd.save(b)
    write(f / "FILE-001/FloorPlan.docx", b.getvalue())
    import pikepdf
    plain = build_doc(garage, fp)
    with pikepdf.open(io.BytesIO(plain)) as pk:
        b = io.BytesIO(); pk.save(b, encryption=pikepdf.Encryption(owner="owner", user="secret")); write(f / "FILE-002/ProtectedPlan.pdf", b.getvalue())
    write(f / "FILE-003/scan0004.pdf", build_doc(garage, fp))
    sp = build_doc(garage, site)
    write(f / "FILE-004/SitePlan.pdf", sp)
    write(f / "FILE-004/SitePlan (1).pdf", sp)
    arch = {"filename": "ArchitecturalPlan.pdf", "document_type": "architectural_plan", "present": True, "shown_details": []}
    unsigned = dict(garage, application=dict(garage["application"], project_type="ici_interior_alteration"))
    write(f / "FILE-005/ArchitecturalPlan.pdf", build_doc(unsigned, arch))
    write(f / "FILE-006/GaragePlan.pdf", build_doc(garage, fp, address_override="55 Different Road, Kitchener"))
    comb = fitz.open()
    make_page(comb, garage, site); make_page(comb, garage, fp)
    make_page(comb, garage, next(d for d in garage["documents"] if d["document_type"] == "application_form"))
    write(f / "FILE-007/CombinedFiles.pdf", comb.tobytes())
    write(f / "FILE-008/RoofPlan.pdf", plain[: len(plain) // 3].replace(b"%PDF", b"%PXX", 1))

    # Fillable application forms using the Ontario form's field names (synthetic layout; values fictional).
    form = OUT / "forms"
    def fillable(path, values):
        doc = fitz.open()
        page = doc.new_page(width=612, height=792)
        page.insert_text((40, 50), "APPLICATION FOR A PERMIT TO CONSTRUCT OR DEMOLISH (synthetic fillable test form)", fontsize=10, fontname="hebo")
        y = 80
        for name in ["Project building number street name", "Project value estimated (in dollars)", "Purpose of application",
                     "Description of proposed work", "Applicant is", "Applicant last name", "Applicant First name",
                     "Name of Applicant for Declaration", "Date Applicant Signed Main Form"]:
            page.insert_text((40, y + 12), name, fontsize=8)
            w = fitz.Widget()
            w.field_name = name
            w.field_type = fitz.PDF_WIDGET_TYPE_TEXT
            w.rect = fitz.Rect(260, y, 570, y + 16)
            w.field_value = values.get(name, "")
            page.add_widget(w)
            y += 26
        write(path, doc.tobytes())
    fillable(form / "filled" / "Application_Form.pdf", {
        "Project building number street name": "987 Test Case Court", "Project value estimated (in dollars)": "16000",
        "Purpose of application": "New construction", "Description of proposed work": "Construct a rear-yard deck",
        "Applicant is": "Owner", "Applicant last name": "Wilson", "Applicant First name": "Jamie",
        "Name of Applicant for Declaration": "Jamie Wilson", "Date Applicant Signed Main Form": "2026-10-16",
    })
    fillable(form / "blank" / "Application_Form.pdf", {})

    # Cross-document inconsistencies.
    deck = next(s for s in scenarios if s["application"]["application_id"] == "MOCK-CONTROL-001")
    side = next(d for d in deck["documents"] if d["document_type"] == "deck_side_view")
    mismatch = dict(deck, project_attributes=dict(deck["project_attributes"], deck_height_metres=0.9))
    write(OUT / "inconsistent/deck_height/Deck_Side_View.pdf", build_doc(deck, side))  # drawing says 0.75 m
    (OUT / "inconsistent/deck_height/submission.json").write_text(json.dumps(
        {"application": mismatch["application"], "project_attributes": mismatch["project_attributes"]}, indent=2) + "\n")
    print("fixtures written")


if __name__ == "__main__":
    main()
