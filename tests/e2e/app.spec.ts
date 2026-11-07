import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";

const DISCLAIMER = "The result is preliminary guidance only.";
const scen = (id: string) => JSON.parse(readFileSync(join(__dirname, "../../data/scenarios", `${id}.json`), "utf8"));
const FILES = join(__dirname, "../../fixtures/files");

async function loadSample(page: Page, title: string) {
  await page.goto("/");
  await page.locator(".card", { hasText: title }).getByRole("button", { name: "Load sample" }).click();
  await page.waitForURL("**/requirements");
  await expect(page.locator("ul.files li").first()).toBeVisible();
}
async function runSample(page: Page, title: string) {
  await loadSample(page, title);
  await page.getByRole("button", { name: "Check my documents" }).click();
  await page.waitForURL("**/results", { timeout: 90_000 });
}
async function seriousViolations(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target}`);
}

for (const [id, title] of [
  ["MOCK-RES-001", "Basement renovation"], ["MOCK-RES-002", "Residential deck"], ["MOCK-RES-003", "Detached garage"],
  ["MOCK-RES-004", "Residential addition"], ["MOCK-MISC-001", "Rooftop solar panels"], ["MOCK-ICI-001", "Commercial interior alteration"],
  ["MOCK-CONTROL-001", "Complete deck (control)"],
] as const) {
  test(`${id}: uploading the sample drawings gives the expected result`, async ({ page }) => {
    const s = scen(id);
    await runSample(page, title);
    await expect(page.locator("#readiness strong")).toHaveText(s.expected.readiness === "appears_ready" ? "Appears ready to submit" : "Action required");
    const shown = await page.locator("article.finding h3").allTextContents();
    expect(shown.sort()).toEqual([...s.expected.messages].sort()); // each message exactly once
    await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  });
}

test("each requirement has its own upload area next to its checklist", async ({ page }) => {
  await loadSample(page, "Residential deck");
  const rows = page.locator(".req-row");
  const n = await rows.count();
  expect(n).toBe(5); // application, site plan, deck plan, side view, other documents
  for (let i = 0; i < n; i++) await expect(rows.nth(i).locator('.req-right input[type="file"]')).toHaveCount(1);
  await expect(page.locator('[data-requirement="deck.side_view"] ul.files li')).toHaveText(/Deck_Side_View\.pdf/);
  await expect(page.locator('[data-requirement="deck.site_plan"]').getByRole("link", { name: "Residential building permits" })).toHaveAttribute("href", /kitchener\.ca/);
  await expect(page.getByRole("button", { name: "Back" }).or(page.getByRole("link", { name: "Back" }))).toBeVisible();
});

test("deck: highlight, overrides, summary and PDF download", async ({ page }) => {
  await runSample(page, "Residential deck");
  const card = page.locator("article.finding", { hasText: "Beam information is incomplete" });
  await card.getByRole("button", { name: "Show me where" }).click();
  await expect(card.locator(".viewer img")).toBeVisible();
  await expect(card.getByText("Where to add it")).toBeVisible();
  for (const box of await page.getByLabel(/dealt with this/).all()) await box.check();
  await expect(page.locator("#readiness strong")).toHaveText("Appears ready to submit");
  for (const box of await page.getByLabel(/dealt with this/).all()) await box.uncheck();
  await page.getByRole("button", { name: "Continue to summary" }).click();
  await expect(page.getByRole("heading", { name: /Missing or incomplete items \(6\)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /JSON/ })).toHaveCount(0);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF summary" }).click()]);
  expect(dl.suggestedFilename()).toBe("MOCK-RES-002-permit-application-summary.pdf");
  const bytes = readFileSync((await dl.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(3000);
});

test("new application: typed project → application details → threshold says no permit needed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start" }).click();
  await page.getByRole("combobox").fill("backyard porch");
  await expect(page.getByRole("option", { name: /Deck or porch/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Selected: Deck or porch")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/application");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#error-summary")).toContainText("Enter the applicant's name.");
  await page.getByLabel(/Applicant name/).fill("Sam Example");
  await page.getByLabel(/Property address/).fill("12 Test Street, Kitchener");
  await page.getByLabel(/Estimated construction value/).fill("9000");
  await page.getByLabel(/Description of proposed work/).fill("Build a low deck at the back door");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/requirements");
  await expect(page.getByText("Answer every question above to see your checklist.")).toBeVisible();
  await page.getByRole("spinbutton").fill("0.4");
  await page.getByRole("group", { name: /permanent roof/ }).getByLabel("No", { exact: true }).check();
  await page.getByRole("group", { name: /heritage/ }).getByLabel("No", { exact: true }).check();
  await expect(page.getByText("A permit may not be required")).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0); // no uploads requested
  await page.getByRole("spinbutton").fill("0.9");
  await expect(page.locator(".req-row").first()).toBeVisible(); // over 0.61 m → checklist appears
  await page.getByRole("spinbutton").fill("0.4");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/results");
  await expect(page.locator("#readiness strong")).toHaveText("A permit may not be required");
  await page.getByRole("button", { name: "Continue to summary" }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF summary" }).click()]);
  expect(readFileSync((await dl.path())!).subarray(0, 5).toString()).toBe("%PDF-");
});

test("no files uploaded: ticks are used and missing documents are reported", async ({ page }) => {
  await loadSample(page, "Residential deck");
  for (const slot of ["general.application", "deck.site_plan", "deck.plan", "deck.side_view"]) {
    const row = page.locator(`[data-requirement="${slot}"]`);
    while (await row.getByRole("button", { name: /^Remove/ }).count()) await row.getByRole("button", { name: /^Remove/ }).first().click();
  }
  await page.locator('[data-requirement="deck.plan"]').getByLabel("Posts").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/results");
  await expect(page.locator("#readiness strong")).toHaveText("Action required");
  await expect(page.getByRole("heading", { name: "Add deck site plan." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Beam information is incomplete. Identify the proposed beam size." })).toBeVisible();
});

test("file problems are reported with the InfoPkg messages", async ({ page }) => {
  await loadSample(page, "Detached garage");
  await page.locator(`[data-requirement="other"] input[type="file"]`).setInputFiles([join(FILES, "FILE-002/ProtectedPlan.pdf"), join(FILES, "FILE-006/GaragePlan.pdf")]);
  await page.getByRole("button", { name: "Check my documents" }).click();
  await page.waitForURL("**/results", { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "Upload an unsecured version of the PDF." })).toBeVisible();
  const mismatch = page.locator("article.finding", { hasText: "Confirm the correct project address." });
  await expect(mismatch.locator(".value").first()).toHaveText("55 Different Road, Kitchener");
});

test("high contrast mode toggles and persists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /High contrast/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  await expect(page.getByRole("button", { name: /High contrast/ })).toHaveAttribute("aria-pressed", "true");
});

test("no serious accessibility violations", async ({ page }) => {
  for (const path of ["/", "/project"]) {
    await page.goto(path);
    expect(await seriousViolations(page)).toEqual([]);
  }
  await loadSample(page, "Residential deck");
  expect(await seriousViolations(page)).toEqual([]);
  await page.goto("/application");
  expect(await seriousViolations(page)).toEqual([]);
  await runSample(page, "Residential deck");
  expect(await seriousViolations(page)).toEqual([]);
});

test("phone width: no horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadSample(page, "Residential deck");
  for (const path of ["/requirements", "/project", "/application"]) {
    if (path !== "/requirements") await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});
