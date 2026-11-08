// Emits JSON Schema for the shapes the review service (services/review) exchanges.
import { writeFileSync, mkdirSync } from "node:fs";
import { z } from "zod";
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
  writeFileSync(new URL(`${name}.json`, out), JSON.stringify({ title: name, ...z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) }, null, 2) + "\n");
}
console.log(`wrote ${Object.keys(shapes).length} schemas`);
