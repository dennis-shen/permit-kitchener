import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  workers: 2,
  use: { baseURL: "http://localhost:3000", trace: "off" },
  webServer: [
    { command: "cd services/vision && .venv/bin/uvicorn app.main:app --port 8000", url: "http://localhost:8000/health", reuseExistingServer: true, timeout: 60_000 },
    { command: "pnpm --filter @permit/web start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 60_000,
      env: { VISION_URL: "http://localhost:8000" } },
  ],
});
