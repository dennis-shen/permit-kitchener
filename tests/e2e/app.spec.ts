import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";

const DISCLAIMER = "The result is preliminary guidance only.";
const scen = (id: string) => JSON.parse(readFileSync(join(__dirname, "../../data/scenarios", `${id}.json`), "utf8"));

async function runDemo(page: import("@playwright/test").Page, title: string) {
  await page.goto("/");
  await page.locator(".card", { hasText: title }).getByRole("button", { name: "Load this demo" }).click();
  await page.waitForURL("**/check");
  await expect(page.locator("ul.files li").first()).toBeVisible();
  await page.getByRole("button", { name: "Review my documents" }).click();
  await page.waitForURL("**/results", { timeout: 90_000 });
}

for (const [id, title] of [
  ["MOCK-RES-001", "Basement renovation"], ["MOCK-RES-002", "Residential deck"], ["MOCK-RES-003", "Detached garage"],
  ["MOCK-RES-004", "Residential addition"], ["MOCK-MISC-001", "Rooftop solar panels"], ["MOCK-ICI-001", "Commercial interior alteration"],
  ["MOCK-CONTROL-001", "Complete deck (control)"],
] as const) {
  test(`${id}: uploading the drawings gives the expected result`, async ({ page }) => {
    const s = scen(id);
    await runDemo(page, title);
    await expect(page.locator("#readiness strong")).toHaveText(s.expected.readiness === "appears_ready" ? "Appears ready to submit" : "Action required");
    const shown = await page.locator("article.finding h3").allTextContents();
    expect(shown.sort()).toEqual([...s.expected.messages].sort()); // each message exactly once
    await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  });
}

test("deck: highlight shows where the guard height should go, and summary prints", async ({ page }) => {
  await runDemo(page, "Residential deck");
  const card = page.locator("article.finding", { hasText: "Beam information is incomplete" });
  await card.getByRole("button", { name: "Show me where" }).click();
  await expect(card.locator(".viewer img")).toBeVisible();
  await expect(card.getByRole("link", { name: /Official City of Kitchener guidance/ })).toHaveAttribute("href", /kitchener\.ca/);
  // ticking "dealt with" on every card clears the live readiness
  for (const box of await page.getByLabel(/dealt with this/).all()) await box.check();
  await expect(page.locator("#readiness strong")).toHaveText("Appears ready to submit");
  for (const box of await page.getByLabel(/dealt with this/).all()) await box.uncheck();
  await page.getByRole("link", { name: "View printable summary" }).click();
  await expect(page.getByRole("heading", { name: /Outstanding items \(6\)/ })).toBeVisible();
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
});

test("questionnaire → checklist", async ({ page }) => {
  await page.goto("/classify");
  await page.getByLabel(/A house/).check(); await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Build a deck or porch").check(); await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("spinbutton").fill("0.4"); await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("No", { exact: true }).check(); await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("No", { exact: true }).check(); await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("A permit may not be required", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "See my checklist" }).click();
  await expect(page.getByRole("heading", { name: "Checklist: Deck or porch" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Deck side view/ })).toBeVisible();
});

test("file problems are reported with the InfoPkg messages", async ({ page }) => {
  await page.goto("/");
  await page.locator(".card", { hasText: "Detached garage" }).getByRole("button", { name: "Load this demo" }).click();
  await page.waitForURL("**/check");
  const dir = join(__dirname, "../../fixtures/files");
  await page.locator('input[type="file"]').setInputFiles([join(dir, "FILE-002/ProtectedPlan.pdf"), join(dir, "FILE-006/GaragePlan.pdf")]);
  await page.getByRole("button", { name: "Review my documents" }).click();
  await page.waitForURL("**/results", { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "Upload an unsecured version of the PDF." })).toBeVisible();
  const mismatch = page.locator("article.finding", { hasText: "Confirm the correct project address." });
  await expect(mismatch.locator(".value").first()).toHaveText("55 Different Road, Kitchener");
});

test("no serious accessibility violations", async ({ page }) => {
  for (const path of ["/", "/classify"]) {
    await page.goto(path);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  }
  await runDemo(page, "Residential deck");
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});
