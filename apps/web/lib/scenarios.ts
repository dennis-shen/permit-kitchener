import type { ApplicationInfo } from "@permit/schema";
import s1 from "../../../data/scenarios/MOCK-RES-001.json";
import s2 from "../../../data/scenarios/MOCK-RES-002.json";
import s3 from "../../../data/scenarios/MOCK-RES-003.json";
import s4 from "../../../data/scenarios/MOCK-RES-004.json";
import s5 from "../../../data/scenarios/MOCK-MISC-001.json";
import s6 from "../../../data/scenarios/MOCK-ICI-001.json";
import s7 from "../../../data/scenarios/MOCK-CONTROL-001.json";

export interface DemoScenario {
  title: string;
  application: ApplicationInfo;
  project_attributes: Record<string, number | boolean | string>;
  documents: { filename: string; document_type: string; present: boolean }[];
}

export const SCENARIOS = [s1, s2, s3, s4, s5, s6, s7] as unknown as DemoScenario[];
