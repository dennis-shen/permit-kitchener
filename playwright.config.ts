import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  workers: 2,
  use: { baseURL: "http://localhost:3000", trace: "off" },
  webServer: [
    { command: "uv run python tests/e2e/review_server.py", url: "http://localhost:8000/health", reuseExistingServer: false, timeout: 60_000,
      env: { PERMIT_UPLOAD_DIR: ".uploads/e2e" } },
    { command: "pnpm --filter @permit/web start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 60_000,
      env: { REVIEW_URL: "http://localhost:8000" } },
  ],
});
