// Emits JSON Schema for the shapes the Python review service must honour.
import { writeFileSync, mkdirSync } from "node:fs";
import { zodToJsonSchema } from "zod-to-json-schema";
import * as S from "../src/index";

const out = new URL("../json/", import.meta.url);
mkdirSync(out, { recursive: true });
const shapes = {
  Submission: S.Submission,
  Finding: S.Finding,
  Evidence: S.Evidence,
  RequirementSet: S.RequirementSet,
  ReviewRequest: S.ReviewRequest,
  ReviewResponse: S.ReviewResponse,
  ReadinessReport: S.ReadinessReport,
};
for (const [name, schema] of Object.entries(shapes)) {
  writeFileSync(new URL(`${name}.json`, out), JSON.stringify(zodToJsonSchema(schema, name), null, 2) + "\n");
}
console.log(`wrote ${Object.keys(shapes).length} schemas`);
