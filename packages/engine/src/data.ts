import { DocumentTypesConfig, ProjectOption, RequirementSet, Resource, type ProjectType } from "@permit/schema";
import general from "../../../data/requirements/general.json";
import basement from "../../../data/requirements/basement_renovation.json";
import deck from "../../../data/requirements/deck_porch.json";
import garage from "../../../data/requirements/detached_garage.json";
import addition from "../../../data/requirements/residential_addition.json";
import solar from "../../../data/requirements/solar_panels.json";
import ici from "../../../data/requirements/ici_interior_alteration.json";
import hvac from "../../../data/requirements/hvac_system.json";
import resources from "../../../data/resources.json";
import projectTypes from "../../../data/project-types.json";
import documentTypes from "../../../data/document-types.json";

export const GENERAL: RequirementSet = RequirementSet.parse(general);

export const REQUIREMENT_SETS: Record<ProjectType, RequirementSet> = {
  basement_renovation: RequirementSet.parse(basement),
  deck_porch: RequirementSet.parse(deck),
  detached_garage: RequirementSet.parse(garage),
  residential_addition: RequirementSet.parse(addition),
  solar_panels: RequirementSet.parse(solar),
  ici_interior_alteration: RequirementSet.parse(ici),
  hvac_system: RequirementSet.parse(hvac),
};

export const RESOURCES: Resource[] = Resource.array().parse(resources);
const byId = new Map(RESOURCES.map((r) => [r.id, r]));

export function resolveResources(ids: string[]): Resource[] {
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [r] : [];
  });
}

export const FALLBACK_URL = byId.get("building-permits")?.url ?? "https://www.kitchener.ca/";

export const PROJECT_OPTIONS: ProjectOption[] = ProjectOption.array().parse(projectTypes.projectTypes);

export const DOCUMENT_TYPES: DocumentTypesConfig = DocumentTypesConfig.parse(documentTypes);
export const DOCUMENT_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.documentTypes.map((d) => [d.type, d.label]),
);
