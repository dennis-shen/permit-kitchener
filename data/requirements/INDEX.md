# Requirement ID index — A1

Stable IDs for the simplified InfoPkg §5 requirements. General requirements apply to every project. JSON filenames use the contract ProjectType; ID prefixes use the short names below. Every detail ID is a `shown_details` value; parent requirement IDs group checklist items.

## Shared conventions

- Application details map to the identically named `application` fields (including `submission_date`, `declaration_completed`, and `signature_present`).
- Deck rear and side property distances are separate issues. Deck and guard heights are separate issues. Shared feedback text is displayed once while the deck scenario still counts eight issues.
- `has_kitchen_or_bathroom: true` enables the basement layout detail. `removes_existing_exterior_wall: true` enables the addition demolition description. `strengthening_required: true` enables solar supplementary-construction details. Unknown applicability must be clarified; it is not evidence that a detail is unnecessary.
- `ici.description.previous_and_proposed_use` carries `staffGuidance: true`; it does not add an unusual-aspect flag or change top-level readiness by itself.
- `alsoAcceptedIn` allows details on combined drawings; an alternative document must actually show the relevant detail IDs.
- Resource IDs reserved for Kiro-2: `building-applications-forms`, `residential-permits`, `miscellaneous-permits`, `ici-permits`. Resolve to official City links in `data/resources.json`.
- Professional stamp/signature/date details mean the applicable professional authentication, as specified in InfoPkg §5.7.

## Permit trigger facts

- Deck: `deck_height_metres >= 0.61` OR `permanent_roof === true`.
- Solar: `mounted_to_building === true` AND `aggregate_panel_area_m2 >= 5`.

## general — §5.1

File: `general.json`

| Requirement ID | Document type | Detail ID | Label |
|---|---|---|---|
| `general.application` | `application_form` | `general.application.applicant_name` | Applicant name |
| `general.application` | `application_form` | `general.application.property_address` | Property address |
| `general.application` | `application_form` | `general.application.applicant_role` | Applicant role |
| `general.application` | `application_form` | `general.application.project_type` | Project type |
| `general.application` | `application_form` | `general.application.project_description` | Project description |
| `general.application` | `application_form` | `general.application.estimated_construction_value` | Estimated construction value |
| `general.application` | `application_form` | `general.application.submission_date` | Application date |
| `general.application` | `application_form` | `general.application.declaration_completed` | Applicant declaration |
| `general.application` | `application_form` | `general.application.signature_present` | Applicant signature |

## basement_renovation — §5.2

File: `basement_renovation.json`

| Requirement ID | Document type | Detail ID | Label |
|---|---|---|---|
| `basement.description` | `project_description` | `basement.description.scope` | Basement project description |
| `basement.floor_plan` | `floor_plan` | `basement.floor_plan.room_names` | Room names |
| `basement.floor_plan` | `floor_plan` | `basement.floor_plan.window_sizes` | Window dimensions |
| `basement.floor_plan` | `floor_plan` | `basement.floor_plan.door_sizes` | Door sizes |
| `basement.floor_plan` | `floor_plan` | `basement.floor_plan.kitchen_bathroom_layout` | Kitchen or bathroom layout |
| `basement.floor_plan` | `floor_plan` | `basement.floor_plan.stairs_location` | Stairs location |
| `basement.floor_plan` | `floor_plan` | `basement.floor_plan.furnace_location` | Furnace location |
| `basement.floor_plan` | `floor_plan` | `basement.floor_plan.new_wall_construction` | New wall construction |
| `basement.floor_plan` | `floor_plan` | `basement.floor_plan.overhead_beam` | Existing ducting or overhead beams |
| `basement.floor_plan` | `floor_plan` | `basement.floor_plan.ceiling_height` | Basement ceiling height |

## deck_porch — §5.3

File: `deck_porch.json`

| Requirement ID | Document type | Detail ID | Label |
|---|---|---|---|
| `deck.site_plan` | `site_plan` | `deck.site_plan.deck_dimensions` | Deck length and width |
| `deck.site_plan` | `site_plan` | `deck.site_plan.deck_location` | Deck location |
| `deck.site_plan` | `site_plan` | `deck.site_plan.rear_property_line_distance` | Rear property-line distance |
| `deck.site_plan` | `site_plan` | `deck.site_plan.side_property_line_distance` | Side property-line distance |
| `deck.site_plan` | `site_plan` | `deck.site_plan.nearby_structures` | Nearby structures |
| `deck.plan` | `deck_plan` | `deck.plan.posts` | Posts |
| `deck.plan` | `deck_plan` | `deck.plan.joist_size_spacing` | Floor-joist size and spacing |
| `deck.plan` | `deck_plan` | `deck.plan.beam_size` | Beam size |
| `deck.plan` | `deck_plan` | `deck.plan.stairs` | Stairs |
| `deck.plan` | `deck_plan` | `deck.plan.landings` | Landings |
| `deck.side_view` | `deck_side_view` | `deck.side_view.deck_height` | Deck height |
| `deck.side_view` | `deck_side_view` | `deck.side_view.guard_height` | Guard height |

## detached_garage — §5.4

File: `detached_garage.json`

| Requirement ID | Document type | Detail ID | Label |
|---|---|---|---|
| `garage.description` | `project_description` | `garage.description.scope` | Garage project description |
| `garage.site_plan` | `site_plan` | `garage.site_plan.structure_dimensions` | Proposed structure dimensions |
| `garage.site_plan` | `site_plan` | `garage.site_plan.property_line_distances` | Property-line distances |
| `garage.site_plan` | `site_plan` | `garage.site_plan.other_structures` | Other structures |
| `garage.floor_plan` | `floor_plan` | `garage.floor_plan.construction_details` | Garage construction details |
| `garage.foundation` | `foundation_plan` | `garage.foundation.slab_detail` | Foundation or slab detail |
| `garage.elevations` | `elevations` | `garage.elevations.all_sides` | Building elevations |
| `garage.elevations` | `elevations` | `garage.elevations.building_height` | Garage height on every elevation |

## residential_addition — §5.5

File: `residential_addition.json`

| Requirement ID | Document type | Detail ID | Label |
|---|---|---|---|
| `addition.description` | `project_description` | `addition.description.scope` | Description of the proposed addition |
| `addition.description` | `project_description` | `addition.description.mentions_demolition` | Description of exterior-wall removal |
| `addition.site_plan` | `site_plan` | `addition.site_plan.addition_location` | Addition location |
| `addition.existing_floor_plan` | `existing_floor_plan` | `addition.existing_floor_plan.existing_layout` | Existing floor layout |
| `addition.floor_plan` | `proposed_floor_plan` | `addition.floor_plan.proposed_layout` | Proposed floor layout |
| `addition.floor_plan` | `proposed_floor_plan` | `addition.floor_plan.existing_proposed_distinction` | Distinction between existing and proposed work |
| `addition.floor_plan` | `proposed_floor_plan` | `addition.floor_plan.window_sizes` | Proposed window sizes |
| `addition.foundation` | `foundation_plan` | `addition.foundation.foundation_details` | Addition foundation details |
| `addition.framing` | `framing_plan` | `addition.framing.framing_details` | Framing information |
| `addition.roof_plan` | `roof_plan` | `addition.roof_plan.roof_layout` | Roof layout |
| `addition.roof_plan` | `roof_plan` | `addition.roof_plan.existing_new_connection` | Existing and proposed roof connection |
| `addition.elevations` | `elevations` | `addition.elevations.all_affected_sides` | Elevations for every affected side |
| `addition.sections` | `sections_details` | `addition.sections.construction_details` | Sections and construction details |

## solar_panels — §5.6

File: `solar_panels.json`

| Requirement ID | Document type | Detail ID | Label |
|---|---|---|---|
| `solar.roof_plan` | `solar_roof_plan` | `solar.roof_plan.panel_locations` | Solar panel locations |
| `solar.roof_plan` | `solar_roof_plan` | `solar.roof_plan.roof_member_sizes_spacing` | Existing roof-member sizes and spacing |
| `solar.roof_plan` | `solar_roof_plan` | `solar.roof_plan.support_locations` | Supporting roof-element locations |
| `solar.structural_review` | `structural_review` | `solar.structural_review.engineer_review` | Engineer review of roof and supporting structure |
| `solar.structural_review` | `structural_review` | `solar.structural_review.strengthening_required` | Statement of whether strengthening is required |
| `solar.structural_review` | `structural_review` | `solar.structural_review.strengthening_details` | Required supplementary construction details |
| `solar.mounting` | `mounting_system_spec` | `solar.mounting.mounting_details` | Mounting details |
| `solar.mounting` | `mounting_system_spec` | `solar.mounting.fastener_sizes_spacing` | Fastener sizes and spacing |
| `solar.mounting` | `mounting_system_spec` | `solar.mounting.rail_support_info` | Rail and support information |
| `solar.mounting` | `mounting_system_spec` | `solar.mounting.system_specifications` | Mounting-system specifications |
| `solar.panel_spec` | `panel_spec` | `solar.panel_spec.manufacturer_specifications` | Panel manufacturer specifications |

## ici_interior_alteration — §5.7

File: `ici_interior_alteration.json`

| Requirement ID | Document type | Detail ID | Label |
|---|---|---|---|
| `ici.description` | `project_description` | `ici.description.previous_and_proposed_use` | Previous and proposed use |
| `ici.code_matrix` | `code_matrix` | `ici.code_matrix.applicable_matrix` | Applicable building code matrix |
| `ici.designer` | `application_form` | `ici.designer.professional_id` | Professional or designer identification |
| `ici.key_plan` | `key_plan` | `ici.key_plan.unit_location` | Unit location within the plaza |
| `ici.architectural_plan` | `architectural_plan` | `ici.architectural_plan.plan_content` | Architectural plan drawing |
| `ici.architectural_plan` | `architectural_plan` | `ici.architectural_plan.professional_id` | Professional or designer identification |
| `ici.architectural_plan` | `architectural_plan` | `ici.architectural_plan.professional_stamp` | Applicable professional stamp |
| `ici.architectural_plan` | `architectural_plan` | `ici.architectural_plan.signature_date` | Applicable signature and date |
| `ici.plumbing_plan` | `plumbing_plan` | `ici.plumbing_plan.plan_content` | Plumbing plan drawing |
| `ici.plumbing_plan` | `plumbing_plan` | `ici.plumbing_plan.professional_id` | Professional or designer identification |
| `ici.plumbing_plan` | `plumbing_plan` | `ici.plumbing_plan.professional_stamp` | Applicable professional stamp |
| `ici.plumbing_plan` | `plumbing_plan` | `ici.plumbing_plan.signature_date` | Applicable signature and date |
| `ici.hvac_plan` | `hvac_plan` | `ici.hvac_plan.plan_content` | HVAC plan drawing |
| `ici.hvac_plan` | `hvac_plan` | `ici.hvac_plan.professional_id` | Professional or designer identification |
| `ici.hvac_plan` | `hvac_plan` | `ici.hvac_plan.professional_stamp` | Applicable professional stamp |
| `ici.hvac_plan` | `hvac_plan` | `ici.hvac_plan.signature_date` | Applicable signature and date |
| `ici.electrical_plan` | `electrical_plan` | `ici.electrical_plan.plan_content` | Electrical plan drawing |
| `ici.electrical_plan` | `electrical_plan` | `ici.electrical_plan.professional_id` | Professional or designer identification |
| `ici.electrical_plan` | `electrical_plan` | `ici.electrical_plan.professional_stamp` | Applicable professional stamp |
| `ici.electrical_plan` | `electrical_plan` | `ici.electrical_plan.signature_date` | Applicable signature and date |
