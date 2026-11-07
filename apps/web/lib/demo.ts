"use client";
import type { AppState, UploadedFile } from "./store";
import type { DemoScenario } from "./scenarios";
import { classify } from "@permit/engine";

const WORK: Record<string, string> = {
  basement_renovation: "finish_basement", deck_porch: "deck_or_porch", detached_garage: "garage_or_shed",
  residential_addition: "addition", solar_panels: "solar", ici_interior_alteration: "interior_alteration",
};

/** Load a demo scenario: its application details and its generated drawings. */
export async function loadDemo(s: DemoScenario): Promise<{ patch: Partial<AppState>; files: UploadedFile[] }> {
  const a = s.project_attributes;
  const answers = {
    workKind: WORK[s.application.project_type] as never,
    buildingKind: s.application.project_type === "ici_interior_alteration" ? ("commercial_unit" as const) : ("house" as const),
    deckHeightMetres: typeof a.deck_height_metres === "number" ? a.deck_height_metres : undefined,
    permanentRoof: a.permanent_roof === true ? ("yes" as const) : a.permanent_roof === false ? ("no" as const) : undefined,
    solarAreaM2: typeof a.aggregate_panel_area_m2 === "number" ? a.aggregate_panel_area_m2 : undefined,
    solarMountedToBuilding: a.mounted_to_building === true ? ("yes" as const) : undefined,
    hasKitchenOrBathroom: a.has_kitchen_or_bathroom === true ? ("yes" as const) : undefined,
  };
  const files: UploadedFile[] = [];
  for (const d of s.documents.filter((d) => d.present)) {
    const res = await fetch(`/demo/${s.application.application_id}/${d.filename}`);
    if (res.ok) files.push({ name: d.filename, bytes: new Uint8Array(await res.arrayBuffer()), type: "application/pdf" });
  }
  return {
    patch: {
      answers,
      classification: classify(answers),
      demoId: s.application.application_id,
      report: null,
      review: {
        application: s.application, attributes: s.project_attributes, vision: null, prechecks: [],
        manualDocs: [], overrides: [], unusualAspects: [],
      },
    },
    files,
  };
}
