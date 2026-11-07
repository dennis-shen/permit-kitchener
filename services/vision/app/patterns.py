"""How each requirement detail is recognised on a drawing.

Each detail id maps to a regex run over a document's text (case-insensitive, per line first,
then over the whole document for multi-line patterns). Measurement details require a value,
so a bare label such as "GUARD" or "REAR PROPERTY LINE" without a dimension does not count.
Details with no entry fall back to the requirement JSON's `visionHints` (word match).
"""
import re

NUM = r"\d+(?:[.,]\d+)?"
DIM = rf"{NUM}\s*(?:m|mm|cm|ft|')"
SIZE = r"\d+\s*-?\s*\d*\s*[x×]\s*\d+"  # 2x10, 3-2x10
OC = r"(?:@|o\.?\s?c\.?|on cent(?:er|re))"

P: dict[str, str] = {
    # basement
    "basement.description.scope": r"basement",
    "basement.floor_plan.room_names": r"\b(recreation room|bedroom|bathroom|rec room)\b",
    "basement.floor_plan.window_sizes": rf"window\s*\(?\s*\d{{3,4}}\s*[x×]\s*\d{{3,4}}",
    "basement.floor_plan.door_sizes": r"\bdoors?\b",
    "basement.floor_plan.kitchen_bathroom_layout": r"\b(toilet|w\.c\.|lavatory|shower|sink|tub|vanity)\b",
    "basement.floor_plan.stairs_location": r"\bstairs?\b",
    "basement.floor_plan.furnace_location": r"\bfurnace\b|\bf\.a\.f\.",
    "basement.floor_plan.new_wall_construction": r"new (partition )?walls?|\bstuds?\b",
    "basement.floor_plan.overhead_beam": r"\b(beam|bulkhead|ductwork)\b",
    "basement.floor_plan.ceiling_height": rf"ceiling (ht|height)\.?\s*[:=]?\s*{NUM}",
    # deck
    "deck.site_plan.deck_dimensions": rf"{DIM}\s*[x×]\s*{DIM}",
    "deck.site_plan.deck_location": r"proposed deck",
    "deck.site_plan.rear_property_line_distance": rf"rear (property line|setback)\D{{0,12}}{DIM}",
    "deck.site_plan.side_property_line_distance": rf"side (property line|setback)\D{{0,12}}{DIM}",
    "deck.site_plan.nearby_structures": r"\b(shed|pool)\b",
    "deck.plan.posts": r"\bposts?\b",
    "deck.plan.joist_size_spacing": rf"joists?\D{{0,12}}{SIZE}\s*{OC}|{SIZE}\s*joists?\s*{OC}",
    "deck.plan.beam_size": rf"beam\D{{0,12}}{SIZE}|{SIZE}\s*(built-up )?beam",
    "deck.plan.stairs": r"\bstairs?\b",
    "deck.plan.landings": r"\blanding\b",
    "deck.side_view.deck_height": rf"deck (ht|height)\.?\D{{0,6}}{DIM}",
    "deck.side_view.guard_height": rf"guard (ht|height)?\.?\D{{0,6}}{DIM}",
    # garage
    "garage.description.scope": r"garage",
    "garage.site_plan.structure_dimensions": rf"{DIM}\s*[x×]\s*{DIM}",
    "garage.site_plan.property_line_distances": rf"(?s)(?=.*left side property line\D{{0,12}}{DIM})(?=.*right side property line\D{{0,12}}{DIM})(?=.*rear property line\D{{0,12}}{DIM})",
    "garage.site_plan.other_structures": r"\bshed\b",
    "garage.floor_plan.construction_details": rf"studs?\s*{OC}|{SIZE}\s*studs?",
    "garage.foundation.slab_detail": r"\b(slab|footing)\b",
    "garage.elevations.all_sides": r"(?s)(?=.*north elevation)(?=.*south elevation)(?=.*east elevation)(?=.*west elevation)",
    # garage.elevations.building_height is a special check (every elevation needs a height) — see checks.py
    # addition
    "addition.description.scope": r"addition",
    "addition.description.mentions_demolition": r"remov\w*\s+(of\s+)?(the\s+)?existing\s+(exterior\s+)?wall|demolition",
    "addition.site_plan.addition_location": r"proposed addition",
    "addition.existing_floor_plan.existing_layout": r"existing (kitchen|dining|layout|floor)",
    "addition.floor_plan.proposed_layout": r"(proposed|new) (kitchen|dining)",
    "addition.floor_plan.existing_proposed_distinction": r"\blegend\b.*|existing to remain|new construction",
    "addition.floor_plan.window_sizes": rf"window\s*\(?\s*\d{{3,4}}\s*[x×]\s*\d{{3,4}}",
    "addition.foundation.foundation_details": r"\bfooting\b|foundation wall",
    "addition.framing.framing_details": rf"(joists?|rafters?|studs?)\D{{0,12}}{SIZE}\s*{OC}",
    "addition.roof_plan.roof_layout": r"roof (slope|pitch)|\d+\s*:\s*12",
    "addition.roof_plan.existing_new_connection": r"(tie-?in|connection)\s+(to|with)\s+existing",
    "addition.elevations.all_affected_sides": r"(?s)(?=.*north elevation)(?=.*south elevation)(?=.*east elevation)(?=.*west elevation)",
    "addition.sections.construction_details": r"\bsection\b|wall assembly",
    # solar
    "solar.roof_plan.panel_locations": r"\b(panels?|array|modules?)\b",
    "solar.roof_plan.roof_member_sizes_spacing": rf"(rafters?|truss(es)?)\D{{0,12}}{SIZE}\s*{OC}",
    "solar.roof_plan.support_locations": r"(attachment|support|standoff)\s+(points?|locations?)",
    "solar.structural_review.engineer_review": r"professional engineer|p\.\s?eng",
    "solar.structural_review.strengthening_required": r"strengthening\s+(is\s+)?(not\s+)?required|no strengthening",
    "solar.mounting.mounting_details": r"mount(ing)?\s+(detail|bracket|foot|feet)",
    "solar.mounting.fastener_sizes_spacing": rf"(lag|screw|bolt)s?\D{{0,20}}\d[^\n]*{OC}",
    "solar.mounting.rail_support_info": rf"rail\D{{0,20}}{DIM}|rail span",
    "solar.mounting.system_specifications": r"mounting system|racking",
    "solar.panel_spec.manufacturer_specifications": r"manufacturer|model no",
    # ICI
    "ici.description.previous_and_proposed_use": r"(?s)previous use\s*:.*proposed use\s*:",
    "ici.code_matrix.applicable_matrix": r"code matrix|data matrix",
    "ici.designer.professional_id": r"\bbcin\b|designer\s*:",
    "ici.key_plan.unit_location": r"key plan",
    "ici.architectural_plan.plan_content": r"architectural|partition",
    "ici.plumbing_plan.plan_content": r"plumbing|sanitary",
    "ici.hvac_plan.plan_content": r"\bhvac\b|mechanical|supply air",
    "ici.electrical_plan.plan_content": r"electrical|lighting",
}

# Professional identification / stamps / signatures for every ICI discipline plan.
for disc in ("architectural_plan", "plumbing_plan", "hvac_plan", "electrical_plan"):
    P[f"ici.{disc}.professional_id"] = r"\bbcin\b\s*:?\s*\d|p\.\s?eng|\boaa\b|licen[cs]e no"
    # professional_stamp and signature_date are visual checks — see checks.py

COMPILED = {k: re.compile(v, re.I) for k, v in P.items()}

# Special visual checks handled in checks.py
VISUAL = {"stamp", "signature_date", "building_height"}
