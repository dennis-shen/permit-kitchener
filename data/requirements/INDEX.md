# Requirement ID index — A1

Stable IDs for the simplified InfoPkg §5 requirements. General requirements apply to every project. JSON filenames use the contract ProjectType; ID prefixes use the short names below. Every detail ID is a `shown_details` value; parent requirement IDs group checklist items.

## Shared conventions

- Application details map to the identically named `application` fields (including `submission_date`, `declaration_completed`, and `signature_present`).
- Deck rear and side property distances are separate issues. Deck and guard heights are separate issues. Shared feedback text is displayed once while the deck scenario still counts eight issues.
- `has_kitchen_or_bathroom: true` enables the basement layout detail. `removes_existing_exterior_wall: true` enables the addition demolition description. `strengthening_required: true` enables solar supplementary-construction details. Unknown applicability must be clarified; it is not evidence that a detail is unnecessary.
- `ici.description.previous_and_proposed_use` carries `staffGuidance: true`; it does not add an unusual-aspect flag or change top-level readiness by itself.
- One PDF per page: each requirement is checked only against the PDF of its own `documentType`. Requirements that share a document type (e.g. `general.application` and `garage.description` on the application form) are shown and checked together as one page.
- Resource IDs reserved for Kiro-2: `building-applications-forms`, `residential-permits`, `miscellaneous-permits`, `ici-permits`. Resolve to official City links in `data/resources.json`.
- Professional stamp/signature/date details mean the applicable professional authentication, as specified in InfoPkg §5.7.

## Permit trigger facts

- Deck: `deck_height_metres >= 0.61` OR `permanent_roof === true`.
- Detached garage / accessory structure: `structure_area_m2 >= 10.03` (108 sq ft) OR `attached_to_structure === true` (City residential permits page).
- Solar: `mounted_to_building === true` AND `aggregate_panel_area_m2 >= 5`.

## general — §5.1

File: `general.json`. Applies to every project type. `general.application` holds the nine §5.1 fields. The other requirements hold every other field the applicant fills in on the Ontario "Application for a Permit to Construct or Demolish" (2026), grouped by form section. The "For use by Principal Authority" box is filled in by the City, and Schedule 2 is only for sewage systems.

- `owner_differs_from_applicant: true` enables Section D (Owner); `builder_known: true` enables Section E (Builder). Both are general preview questions.
- Details marked `optional` (unit number, fax, plan number and so on) are listed but never reported as missing.
- Each application-form detail names its form `section`; the page groups by these (`data/document-types.json`).
- A complete form in a scenario shows every one of these fields (`scripts/build_scenarios.py`), so the golden messages are unchanged. A missing form is reported once.

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
| `general.site` | `application_form` | `general.site.submitted_to` | Municipality the application is submitted to |
| `general.site` | `application_form` | `general.site.unit_number` | Project unit number |
| `general.site` | `application_form` | `general.site.lot_con` | Project lot/concession |
| `general.site` | `application_form` | `general.site.municipality` | Project municipality |
| `general.site` | `application_form` | `general.site.postal_code` | Project postal code |
| `general.site` | `application_form` | `general.site.plan_number` | Plan number or other description |
| `general.site` | `application_form` | `general.site.area_of_work` | Area of work (m²) |
| `general.site` | `application_form` | `general.site.proposed_use` | Proposed use of building |
| `general.site` | `application_form` | `general.site.current_use` | Current use of building |
| `general.applicant` | `application_form` | `general.applicant.corporation` | Applicant corporation or partnership |
| `general.applicant` | `application_form` | `general.applicant.street_address` | Applicant street address |
| `general.applicant` | `application_form` | `general.applicant.unit_number` | Applicant unit number |
| `general.applicant` | `application_form` | `general.applicant.lot_con` | Applicant lot/concession |
| `general.applicant` | `application_form` | `general.applicant.municipality` | Applicant municipality |
| `general.applicant` | `application_form` | `general.applicant.postal_code` | Applicant postal code |
| `general.applicant` | `application_form` | `general.applicant.province` | Applicant province |
| `general.applicant` | `application_form` | `general.applicant.email` | Applicant email |
| `general.applicant` | `application_form` | `general.applicant.telephone` | Applicant telephone number |
| `general.applicant` | `application_form` | `general.applicant.fax` | Applicant fax number |
| `general.applicant` | `application_form` | `general.applicant.cell` | Applicant cell number |
| `general.owner` | `application_form` | `general.owner.last_name` | Owner last name |
| `general.owner` | `application_form` | `general.owner.first_name` | Owner first name |
| `general.owner` | `application_form` | `general.owner.corporation` | Owner corporation or partnership |
| `general.owner` | `application_form` | `general.owner.street_address` | Owner street address |
| `general.owner` | `application_form` | `general.owner.unit_number` | Owner unit number |
| `general.owner` | `application_form` | `general.owner.lot_con` | Owner lot/concession |
| `general.owner` | `application_form` | `general.owner.municipality` | Owner municipality |
| `general.owner` | `application_form` | `general.owner.postal_code` | Owner postal code |
| `general.owner` | `application_form` | `general.owner.province` | Owner province |
| `general.owner` | `application_form` | `general.owner.email` | Owner email |
| `general.owner` | `application_form` | `general.owner.telephone` | Owner telephone number |
| `general.owner` | `application_form` | `general.owner.fax` | Owner fax number |
| `general.owner` | `application_form` | `general.owner.cell` | Owner cell number |
| `general.builder` | `application_form` | `general.builder.last_name` | Builder last name |
| `general.builder` | `application_form` | `general.builder.first_name` | Builder first name |
| `general.builder` | `application_form` | `general.builder.corporation` | Builder corporation or partnership |
| `general.builder` | `application_form` | `general.builder.street_address` | Builder street address |
| `general.builder` | `application_form` | `general.builder.unit_number` | Builder unit number |
| `general.builder` | `application_form` | `general.builder.lot_con` | Builder lot/concession |
| `general.builder` | `application_form` | `general.builder.municipality` | Builder municipality |
| `general.builder` | `application_form` | `general.builder.postal_code` | Builder postal code |
| `general.builder` | `application_form` | `general.builder.province` | Builder province |
| `general.builder` | `application_form` | `general.builder.email` | Builder email |
| `general.builder` | `application_form` | `general.builder.telephone` | Builder telephone number |
| `general.builder` | `application_form` | `general.builder.fax` | Builder fax number |
| `general.builder` | `application_form` | `general.builder.cell` | Builder cell number |
| `general.licensing` | `application_form` | `general.licensing.new_home` | Answer to “Is the proposed construction for a new home?” |
| `general.licensing` | `application_form` | `general.licensing.licence_required` | Answer to “Is a licence required?” |
| `general.licensing` | `application_form` | `general.licensing.licence_numbers` | Licence number(s) |
| `general.completeness` | `application_form` | `general.completeness.meets_requirements` | Answer to H(i): application meets the Building Code requirements |
| `general.completeness` | `application_form` | `general.completeness.fees_paid` | Answer to H(i): required fees paid |
| `general.completeness` | `application_form` | `general.completeness.plans_and_specifications` | Answer to H(ii): plans and specifications attached |
| `general.completeness` | `application_form` | `general.completeness.information_and_documents` | Answer to H(iii): information and documents attached |
| `general.completeness` | `application_form` | `general.completeness.applicable_law` | Answer to H(iv): work will not contravene applicable law |

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
| `garage.description` | `application_form` | `garage.description.scope` | Garage project description |
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
| `addition.floor_plan` | `proposed_floor_plan` | `addition.floor_plan.framing_details` | Framing information |
| `addition.roof_plan` | `roof_plan` | `addition.roof_plan.roof_layout` | Roof layout |
| `addition.roof_plan` | `roof_plan` | `addition.roof_plan.existing_new_connection` | Existing and proposed roof connection |
| `addition.elevations` | `elevations` | `addition.elevations.all_affected_sides` | Elevations for every affected side |
| `addition.foundation` | `foundation_plan` | `addition.foundation.construction_details` | Sections and construction details |

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

## hvac_system — City page (not in the InfoPkg)

File: `hvac_system.json`. Source: "Changing an HVAC system" on the City's residential building permits page (`#hvacsystem`), which lists the application form, Schedule 1 (completed by a BCIN HVAC designer) and the heat loss/heat gain calculations (by a BCIN designer or professional engineer). Schedule 1 is page 3 of the same Ontario PDF, so it is checked on the application form upload (sections "Schedule 1, Section A" to "D"); the form's own fields are in `general.json`. Every field on Schedule 1 and on the City's Heat Loss and Gain Calculation Summary Sheet (CSA F280) is a detail.

- No permit trigger: the City says a permit is needed to change an HVAC heating system.
- Details marked `optional` are listed on the page but never reported as missing.
- Checking is a placeholder: every field on an uploaded PDF counts as found (`PLACEHOLDER_TICKS`).

| Requirement ID | Document type | Detail ID | Label |
|---|---|---|---|
| `hvac.designer_project` | `application_form` | `hvac.designer_project.street_address` | Project building number and street name |
| `hvac.designer_project` | `application_form` | `hvac.designer_project.unit_number` | Project unit number |
| `hvac.designer_project` | `application_form` | `hvac.designer_project.lot_con` | Project lot/concession |
| `hvac.designer_project` | `application_form` | `hvac.designer_project.municipality` | Project municipality |
| `hvac.designer_project` | `application_form` | `hvac.designer_project.postal_code` | Project postal code |
| `hvac.designer_project` | `application_form` | `hvac.designer_project.plan_number` | Plan number or other description |
| `hvac.designer` | `application_form` | `hvac.designer.name` | Designer name |
| `hvac.designer` | `application_form` | `hvac.designer.firm` | Designer firm |
| `hvac.designer` | `application_form` | `hvac.designer.street_address` | Designer street address |
| `hvac.designer` | `application_form` | `hvac.designer.unit_number` | Designer unit number |
| `hvac.designer` | `application_form` | `hvac.designer.lot_con` | Designer lot/concession |
| `hvac.designer` | `application_form` | `hvac.designer.municipality` | Designer municipality |
| `hvac.designer` | `application_form` | `hvac.designer.postal_code` | Designer postal code |
| `hvac.designer` | `application_form` | `hvac.designer.province` | Designer province |
| `hvac.designer` | `application_form` | `hvac.designer.email` | Designer email |
| `hvac.designer` | `application_form` | `hvac.designer.telephone` | Designer telephone number |
| `hvac.designer` | `application_form` | `hvac.designer.fax` | Designer fax number |
| `hvac.designer` | `application_form` | `hvac.designer.cell` | Designer cell number |
| `hvac.design_activities` | `application_form` | `hvac.design_activities.hvac_house` | HVAC – House ticked |
| `hvac.design_activities` | `application_form` | `hvac.design_activities.work_description` | Description of designer’s work |
| `hvac.designer_declaration` | `application_form` | `hvac.designer_declaration.printed_name` | Designer name in the declaration |
| `hvac.designer_declaration` | `application_form` | `hvac.designer_declaration.basis` | Designer qualification choice |
| `hvac.designer_declaration` | `application_form` | `hvac.designer_declaration.individual_bcin` | Individual BCIN |
| `hvac.designer_declaration` | `application_form` | `hvac.designer_declaration.firm_bcin` | Firm BCIN |
| `hvac.designer_declaration` | `application_form` | `hvac.designer_declaration.exemption_basis` | Basis for exemption |
| `hvac.designer_declaration` | `application_form` | `hvac.designer_declaration.date` | Designer declaration date |
| `hvac.designer_declaration` | `application_form` | `hvac.designer_declaration.signature` | Designer signature |
| `hvac.heat_location` | `heat_loss_gain` | `hvac.heat_location.address` | Building address |
| `hvac.heat_location` | `heat_loss_gain` | `hvac.heat_location.city_province` | Building city and province |
| `hvac.heat_location` | `heat_loss_gain` | `hvac.heat_location.postal_code` | Building postal code |
| `hvac.heat_location` | `heat_loss_gain` | `hvac.heat_location.model` | House model |
| `hvac.heat_location` | `heat_loss_gain` | `hvac.heat_location.site` | Site |
| `hvac.heat_location` | `heat_loss_gain` | `hvac.heat_location.lot` | Lot |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.dimensional_information` | Dimensional information |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.attached_detached` | Attached or Detached |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.front_facing_direction` | Front facing direction |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.storeys` | Number of storeys |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.air_tightness` | Air tightness |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.weather_location` | Weather location |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.ventilated` | Ventilated |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.wind_exposure` | Wind exposure |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.hrv` | HRV (Yes or No) |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.recovery_efficiency` | HRV recovery efficiency (%) |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.internal_shading` | Internal shading |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.occupants` | Number of occupants |
| `hvac.heat_basis` | `heat_loss_gain` | `hvac.heat_basis.units` | Units (imperial or metric) |
| `hvac.heat_design_conditions` | `heat_loss_gain` | `hvac.heat_design_conditions.heating_outdoor_temp` | Heating outdoor temperature |
| `hvac.heat_design_conditions` | `heat_loss_gain` | `hvac.heat_design_conditions.heating_indoor_temp` | Heating indoor temperature |
| `hvac.heat_design_conditions` | `heat_loss_gain` | `hvac.heat_design_conditions.mean_soil_temp` | Mean soil temperature |
| `hvac.heat_design_conditions` | `heat_loss_gain` | `hvac.heat_design_conditions.cooling_outdoor_temp` | Cooling outdoor temperature |
| `hvac.heat_design_conditions` | `heat_loss_gain` | `hvac.heat_design_conditions.cooling_indoor_temp` | Cooling indoor temperature |
| `hvac.heat_design_conditions` | `heat_loss_gain` | `hvac.heat_design_conditions.latitude` | Latitude |
| `hvac.heat_design_conditions` | `heat_loss_gain` | `hvac.heat_design_conditions.temperature_range` | Cooling temperature range |
| `hvac.heat_construction` | `heat_loss_gain` | `hvac.heat_construction.above_grade_walls` | Above-grade walls |
| `hvac.heat_construction` | `heat_loss_gain` | `hvac.heat_construction.below_grade_walls` | Below-grade walls |
| `hvac.heat_construction` | `heat_loss_gain` | `hvac.heat_construction.floors_on_soil` | Floors on soil |
| `hvac.heat_construction` | `heat_loss_gain` | `hvac.heat_construction.ceilings` | Ceilings |
| `hvac.heat_construction` | `heat_loss_gain` | `hvac.heat_construction.exposed_floors` | Exposed floors |
| `hvac.heat_construction` | `heat_loss_gain` | `hvac.heat_construction.exterior_doors` | Exterior doors |
| `hvac.heat_construction` | `heat_loss_gain` | `hvac.heat_construction.windows` | Windows |
| `hvac.heat_construction` | `heat_loss_gain` | `hvac.heat_construction.skylights` | Skylights |
| `hvac.heat_construction` | `heat_loss_gain` | `hvac.heat_construction.attached_documents` | Attached documents |
| `hvac.heat_construction` | `heat_loss_gain` | `hvac.heat_construction.notes` | Notes |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.name` | Designer name |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.company` | Company |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.address` | Designer address |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.city_province` | Designer city and province |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.postal_code` | Designer postal code |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.email` | Designer email |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.telephone` | Designer telephone number |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.qualifications` | Designer qualifications |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.bcin` | Designer BCIN |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.firm_bcin` | Firm BCIN |
| `hvac.heat_designer` | `heat_loss_gain` | `hvac.heat_designer.signature` | Designer signature |
