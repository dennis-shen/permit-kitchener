import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["packages/*/src/**/*.test.ts", "tests/golden/**/*.test.ts", "tests/policy/**/*.test.ts"], passWithNoTests: true },
});
