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
  await page.waitForURL("**/requirements**");
  await expect(page.locator(".file-card")).toBeVisible();
  await expect(page.getByText("Saving and checking the file")).toHaveCount(0, { timeout: 60_000 });
}
/** Click Next through every document page, accepting "Continue anyway" when items are unfinished. */
async function walkToDeclaration(page: Page) {
  for (let i = 0; i < 12 && !page.url().includes("/declaration"); i++) {
    await expect(page.getByText("Saving and checking the file")).toHaveCount(0, { timeout: 60_000 });
    await page.getByRole("button", { name: /^Next/ }).click();
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible().catch(() => false)) await dialog.getByRole("button", { name: "Continue anyway" }).click();
    await page.waitForTimeout(150);
  }
  await page.waitForURL("**/declaration");
}
async function declare(page: Page) {
  await page.getByLabel(/full name, as printed/).fill("Test Applicant");
  for (const box of await page.locator('input[type="checkbox"][required]').all()) await box.check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/summary");
}
async function seriousViolations(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target}`);
}

/**
 * PLACEHOLDER MODE (apps/web/lib/review.ts → PLACEHOLDER_TICKS): an uploaded PDF ticks every item on its page,
 * so only documents that are not uploaded remain unfinished. The InfoPkg detail-level expectations are still
 * enforced on the engine by tests/golden; restore the scenario messages here when real checking returns.
 */
const PLACEHOLDER_EXPECTED: Record<string, string[]> = {
  "MOCK-RES-001": [],
  "MOCK-RES-002": [],
  "MOCK-RES-003": ["Foundation information is missing. Add the proposed foundation or slab detail."],
  "MOCK-RES-004": [],
  "MOCK-MISC-001": [
    "Structural review is missing. Add the professional engineer’s review of the existing roof and supporting structure.",
    "Strengthening requirements are unclear. Indicate whether supplementary construction is required.",
  ],
  "MOCK-ICI-001": [
    "Code matrix is missing. Include the applicable building code matrix.",
    "Key plan is missing. Add a plan showing the location of the unit within the plaza.",
    "Electrical plan is missing. Add the required electrical drawing.",
  ],
  "MOCK-CONTROL-001": [],
};

for (const [id, title] of [
  ["MOCK-RES-001", "Basement renovation"], ["MOCK-RES-002", "Residential deck"], ["MOCK-RES-003", "Detached garage"],
  ["MOCK-RES-004", "Residential addition"], ["MOCK-MISC-001", "Rooftop solar panels"], ["MOCK-ICI-001", "Commercial interior alteration"],
  ["MOCK-CONTROL-001", "Complete deck (control)"],
] as const) {
  test(`${id}: placeholder ticks — only missing documents remain`, async ({ page }) => {
    const expected = PLACEHOLDER_EXPECTED[id]!;
    await loadSample(page, title);
    await walkToDeclaration(page);
    await declare(page);
    const ready = expected.length === 0;
    await expect(page.locator("#readiness strong")).toHaveText(ready ? "Appears ready to submit" : "Application incomplete");
    const shown = await page.locator("ul.unfinished .msg").allTextContents();
    expect(shown.sort()).toEqual([...expected].sort());
    await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("**/confirmation");
    await expect(page.locator(".confirm-hero .big")).toHaveText(ready ? "Application appears complete" : "Application incomplete");
  });
}

test("one PDF per page, no user ticks; an upload ticks its whole page (placeholder)", async ({ page }) => {
  await loadSample(page, "Residential deck");
  await expect(page.locator(".progress li")).toHaveCount(4);
  await expect(page.locator("main input[type=checkbox]")).toHaveCount(0);
  await expect(page.locator('main input[type="file"]')).toHaveCount(1);
  await expect(page.locator('ul.checks li:not([data-state="found"])')).toHaveCount(0);
  await page.locator(".progress").getByRole("button", { name: /Deck plan/ }).click();
  await expect(page.locator('[data-check="deck.plan.beam_size"]')).toHaveAttribute("data-state", "found");
});

test("garage: project description is checked on the application form, not split over two PDFs", async ({ page }) => {
  await loadSample(page, "Detached garage");
  await expect(page.locator(".progress li")).toHaveText([/Application form/, /Site plan/, /Floor plan/, /Foundation plan/, /Elevations/]);
  // grouped with the form's own Section B field, under the completed items
  const sectionB = page.locator("details.req-group", { has: page.locator("h3", { hasText: "Section B: Purpose of application" }) });
  await expect(sectionB.locator('[data-check="garage.description.scope"]')).toHaveAttribute("data-state", "found");
  await expect(sectionB.locator('[data-check="general.application.project_description"]')).toHaveCount(1);
});

test("Next with unfinished items asks before continuing", async ({ page }) => {
  await loadSample(page, "Residential deck");
  await page.getByRole("button", { name: /^Remove/ }).click(); // no application form on page 1
  await page.getByRole("button", { name: /^Next/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Do you want to continue anyway?");
  await dialog.getByRole("button", { name: "Stay on this page" }).click();
  await expect(page.getByText("Document 1 of 4")).toBeVisible();
  await page.getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue anyway" }).click();
  await expect(page.getByText("Document 2 of 4")).toBeVisible();
});

test("summary items link back to their page; PDF downloads", async ({ page }) => {
  await loadSample(page, "Commercial interior alteration");
  await walkToDeclaration(page);
  await declare(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF summary" }).click()]);
  expect(dl.suggestedFilename()).toBe("MOCK-ICI-001-permit-application-summary.pdf");
  expect(readFileSync((await dl.path())!).subarray(0, 5).toString()).toBe("%PDF-");
  await page.locator("ul.unfinished a", { hasText: "Key plan is missing" }).click();
  await page.waitForURL("**/requirements?page=key_plan");
  await expect(page.getByRole("heading", { name: "Key plan", exact: true })).toBeVisible();
});

test("new application: project → preview → application → requirements", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  // later sections are not clickable before they are visited
  await expect(page.locator("nav.steps a", { hasText: "Summary" })).toHaveCount(0);
  await page.getByRole("combobox").fill("backyard porch");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/preview");
  await page.getByRole("spinbutton").fill("0.4");
  await page.getByRole("group", { name: /permanent roof/ }).getByLabel("No", { exact: true }).check();
  await page.getByRole("group", { name: /heritage/ }).getByLabel("No", { exact: true }).check();
  await expect(page.getByText("A permit may not be required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("spinbutton").fill("0.9");
  await expect(page.getByText("A building permit is likely required")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/application");
  await expect(page.getByText(/Declaration and signature/)).toHaveCount(0); // moved to the end
  await page.getByLabel(/Applicant full name/).fill("   ");
  await page.getByLabel(/Property address/).fill("12 Test Street, Kitchener");
  await page.getByLabel(/Estimated construction value/).fill("9000");
  await page.getByLabel(/Description of proposed work/).fill("Build a deck at the back door");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#error-summary")).toContainText("Enter the applicant's name.");
  await expect(page.locator("#error-summary")).not.toContainText("first and last");
  await page.getByLabel(/Applicant full name/).fill("Sam"); // any non-blank name is accepted
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/requirements**");
  await expect(page.getByText("Document 1 of 4")).toBeVisible();
  await expect(page.locator("nav.steps a", { hasText: "Preview" })).toHaveCount(1); // visited → clickable
  // details typed in the Application step do NOT tick anything here; only the uploaded PDF does
  const name = page.locator('[data-check="general.application.applicant_name"]');
  await expect(name).toHaveAttribute("data-state", "pending");
  // nothing uploaded: every field is listed, grouped by the form's sections in form order
  await expect(page.locator(".req-left h3.group-title")).toHaveText([
    "Section A: Project information", "Section B: Purpose of application", "Section C: Applicant", "Section I: Declaration of applicant",
  ]);
  await expect(page.locator("ul.checks li")).toHaveCount(9);
  // ...each section collapsed, showing how many items it holds; opening one lists them all
  await expect(page.locator("details.req-group[open]")).toHaveCount(0);
  await expect(name).toBeHidden();
  const sectionC = page.locator("details.req-group", { hasText: "Section C: Applicant" });
  await expect(sectionC.locator("summary")).toContainText("2 items");
  await sectionC.locator("summary").click();
  await expect(name).toBeVisible();
  await expect(page.locator('[data-state="found"]')).toHaveCount(0);
  // placeholder: uploading the PDF ticks every item on this page
  await page.locator('main input[type="file"]').setInputFiles(join(__dirname, "../../fixtures/drawings/vector/MOCK-CONTROL-001/Application_Form.pdf"));
  await expect(name).toHaveAttribute("data-state", "found");
  await expect(page.locator('[data-state="found"]')).toHaveCount(9);
  // complete sections are collapsed and marked done; only sections with unfinished fields open (none here)
  await expect(page.getByText("All 9 items on this page are ticked.")).toBeVisible();
  await expect(page.locator("details.req-group[open]")).toHaveCount(0);
  await expect(sectionC.locator("summary")).toContainText("All 2 complete");
  await expect(name).toBeHidden();
  await sectionC.locator("summary").click();
  await expect(name).toBeVisible();
  // remove it: back to unchecked
  await page.getByRole("button", { name: /^Remove/ }).click();
  await expect(name).toHaveAttribute("data-state", "pending");
});

test("no checklist on any page is pre-ticked from earlier steps", async ({ page }) => {
  // a fully filled-in sample, but with every uploaded file removed
  await loadSample(page, "Detached garage");
  const pages = await page.locator(".progress li").count();
  expect(pages).toBe(5);
  for (let i = 0; i < pages; i++) {
    await page.locator(".progress li button").nth(i).click();
    while (await page.getByRole("button", { name: /^Remove/ }).count()) await page.getByRole("button", { name: /^Remove/ }).click();
    const checks = page.locator("ul.checks li");
    expect(await checks.count()).toBeGreaterThan(0);
    await expect(page.locator('ul.checks li[data-state="found"]')).toHaveCount(0);
    for (const c of await checks.all()) await expect(c).toHaveAttribute("data-state", "pending");
  }
  // uploading one page's PDF ticks only that page
  await page.locator(".progress li button").nth(1).click();
  await page.locator('main input[type="file"]').setInputFiles(join(__dirname, "../../fixtures/drawings/vector/MOCK-RES-003/Garage_Site_Plan.pdf"));
  await expect(page.locator('[data-check="garage.site_plan.structure_dimensions"]')).toHaveAttribute("data-state", "found", { timeout: 30_000 });
  await page.locator(".progress li button").nth(0).click();
  await expect(page.locator('ul.checks li[data-state="found"]')).toHaveCount(0);
  await page.locator(".progress li button").nth(4).click();
  await expect(page.locator('ul.checks li[data-state="found"]')).toHaveCount(0);
});

test("declaration is required, including designer and corporation statements for ICI", async ({ page }) => {
  await loadSample(page, "Commercial interior alteration");
  await walkToDeclaration(page);
  const cont = page.getByRole("button", { name: "Continue" });
  await expect(cont).toBeDisabled();
  await expect(page.getByLabel(/full name, as printed/)).toHaveValue(""); // not prefilled from earlier steps
  await page.getByLabel(/full name, as printed/).fill("Riley Thompson");
  await expect(page.locator('input[type="checkbox"][required]')).toHaveCount(4); // declare, authority, signed, designer
  await page.getByLabel(/declare that/).check();
  await page.getByLabel(/I have signed/).check();
  await expect(cont).toBeDisabled();
  await page.getByLabel(/authority to bind/).check();
  await page.getByLabel(/Schedule 1/).check();
  await expect(cont).toBeEnabled();
});

test("file problems are shown on the page with the InfoPkg messages", async ({ page }) => {
  await loadSample(page, "Detached garage");
  await page.locator(".progress").getByRole("button", { name: /Floor plan/ }).click();
  await page.locator('main input[type="file"]').setInputFiles(join(FILES, "FILE-008/RoofPlan.pdf"));
  await expect(page.getByLabel("Problems with this file")).toContainText("Replace the file with a readable copy.", { timeout: 30_000 });
  await page.locator(".progress").getByRole("button", { name: /Site plan/ }).click();
  await page.locator('main input[type="file"]').setInputFiles(join(FILES, "FILE-003/scan0004.pdf"));
  await expect(page.getByLabel("Problems with this file")).toContainText("Rename the file so its content can be identified.", { timeout: 30_000 });
});

test("external links open in a new tab; Manrope font; no high-contrast toggle", async ({ page }) => {
  await loadSample(page, "Residential deck");
  for (const path of ["/requirements", "/preview", "/project"]) {
    if (path !== "/requirements") await page.goto(path);
    const external = page.locator('a[href^="http"]');
    expect(await external.count()).toBeGreaterThan(0);
    for (const a of await external.all()) await expect(a).toHaveAttribute("target", "_blank");
  }
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain("Manrope");
  await expect(page.getByRole("button", { name: /contrast/i })).toHaveCount(0);
});

test("no serious accessibility violations", async ({ page }) => {
  for (const path of ["/", "/project"]) {
    await page.goto(path);
    expect(await seriousViolations(page)).toEqual([]);
  }
  await loadSample(page, "Residential deck");
  expect(await seriousViolations(page)).toEqual([]);
  for (const path of ["/preview", "/application"]) {
    await page.goto(path);
    expect(await seriousViolations(page)).toEqual([]);
  }
  await page.goto("/requirements");
  await walkToDeclaration(page);
  expect(await seriousViolations(page)).toEqual([]);
  await declare(page);
  expect(await seriousViolations(page)).toEqual([]);
});

test("preview checkbox sits right next to its label", async ({ page }) => {
  await loadSample(page, "Residential deck");
  await page.goto("/preview");
  const box = page.getByRole("checkbox", { name: "I don't know yet" });
  const b = (await box.boundingBox())!;
  const t = (await page.getByText("I don't know yet").boundingBox())!;
  expect(b.width).toBeLessThan(30);
  expect(t.x - (b.x + b.width)).toBeLessThan(16);
});

test("a long file name wraps; the Remove button stays one line", async ({ page }) => {
  await loadSample(page, "Residential deck");
  const long = "mmah-building-development-application-for-a-permit-to-construct-or-demolish-2026-en-2026-01-27.pdf";
  await page.locator('main input[type="file"]').setInputFiles({ name: long, mimeType: "application/pdf",
    buffer: readFileSync(join(__dirname, "../../fixtures/drawings/vector/MOCK-RES-002/Application_Form.pdf")) });
  await expect(page.locator(".file-card")).toContainText(long);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const btn = (await page.getByRole("button", { name: /^Remove/ }).boundingBox())!;
    expect(btn.height).toBeLessThan(50); // one line, not stacked letters
    expect(btn.width).toBeGreaterThan(60);
  }
});

test("phone width: no horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadSample(page, "Residential deck");
  for (const path of ["/requirements", "/preview", "/application", "/project"]) {
    if (path !== "/requirements") await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});

test("uploads are saved on the server: they survive going back, a full reload and a new tab", async ({ page, context }) => {
  await loadSample(page, "Residential deck");
  await page.locator(".progress").getByRole("button", { name: /Deck plan/ }).click();
  await page.locator('main input[type="file"]').setInputFiles({ name: "My_Deck_Plan.pdf", mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\n% my own deck plan\n") });
  await expect(page.locator(".file-card")).toContainText("My_Deck_Plan.pdf");
  await expect(page.getByText("Saving and checking the file")).toHaveCount(0, { timeout: 30_000 });
  // full page loads (as the step bar and summary links do), back and forward
  await page.goto("/application");
  await page.goto("/requirements?page=deck_plan");
  await expect(page.locator(".file-card")).toContainText("My_Deck_Plan.pdf");
  await page.reload();
  await expect(page.locator(".file-card")).toContainText("My_Deck_Plan.pdf");
  await page.goBack();
  await page.goForward();
  await expect(page.locator(".file-card")).toContainText("My_Deck_Plan.pdf");
  const other = await context.newPage();
  await other.goto("/requirements?page=deck_plan");
  await expect(other.locator(".file-card")).toContainText("My_Deck_Plan.pdf");
  // removing it is saved too
  await page.getByRole("button", { name: /^Remove/ }).click();
  await expect(page.locator(".file-card")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".file-card")).toHaveCount(0);
});

test("a complete sample has no duplicate warning; the same file on two pages names the other page", async ({ page }) => {
  await loadSample(page, "Complete deck (control)");
  await walkToDeclaration(page);
  await declare(page);
  await expect(page.getByText("Confirm which version should be included.")).toHaveCount(0);
  await expect(page.locator("#readiness")).toContainText("Appears ready to submit");
  // now put the site plan's PDF on the deck plan page as well
  await page.goto("/requirements?page=deck_plan");
  await page.locator('main input[type="file"]').setInputFiles(join(__dirname, "../../apps/web/public/demo/MOCK-CONTROL-001/Site_Plan.pdf"));
  const problems = page.getByLabel("Problems with this file");
  await expect(problems).toContainText("Confirm which version should be included.", { timeout: 30_000 });
  await expect(problems).toContainText("same file as the one on the site plan page");
});

test("changing an HVAC system: dropdown → three documents from the City page, every field ticked on upload", async ({ page }) => {
  const form = readFileSync(join(__dirname, "../../fixtures/drawings/vector/MOCK-CONTROL-001/Application_Form.pdf"));
  const other = readFileSync(join(__dirname, "../../fixtures/drawings/vector/MOCK-CONTROL-001/Site_Plan.pdf"));
  const pdf = (name: string, buffer: Buffer) => ({ name, mimeType: "application/pdf", buffer });
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("combobox").fill("replace my furnace");
  await expect(page.getByRole("option").first()).toContainText("Changing an HVAC system");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/preview");
  await page.getByRole("group", { name: /someone other than the applicant/ }).getByLabel("No", { exact: true }).check();
  await page.getByRole("group", { name: /who will install/ }).getByLabel("Yes", { exact: true }).check();
  await page.getByRole("group", { name: /heritage/ }).getByLabel("No", { exact: true }).check();
  await expect(page.getByText("A building permit is likely required")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/application");
  await page.getByLabel(/Applicant full name/).fill("Sam Example");
  await page.getByLabel(/Property address/).fill("12 Test Street, Kitchener");
  await page.getByLabel(/Estimated construction value/).fill("8000");
  await page.getByLabel(/Description of proposed work/).fill("Replace the gas furnace and add central air");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/requirements**");
  await expect(page.locator(".progress li")).toHaveText([/Application form/, /Schedule 1: Designer information/, /Heat loss and gain calculations/]);

  // application form: the general fields plus every other field on the Ontario form; Section E (builder known) but not D
  await expect(page.locator('[data-check="hvac.builder.last_name"]')).toHaveAttribute("data-state", "pending");
  await expect(page.locator('[data-check^="hvac.owner."]')).toHaveCount(0);
  await expect(page.locator('[data-check="hvac.site.unit_number"]')).toContainText("(if applicable)");
  const checks = page.locator("ul.checks li");
  const upload = async (name: string, buffer: Buffer) => {
    await page.locator('main input[type="file"]').setInputFiles(pdf(name, buffer));
    await expect(page.getByText("Saving and checking the file")).toHaveCount(0, { timeout: 60_000 });
    await expect(page.locator('ul.checks li:not([data-state="found"])')).toHaveCount(0); // placeholder: every field found
    expect(await checks.count()).toBeGreaterThan(5);
  };
  await upload("Application_Form.pdf", form);
  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByText("Document 2 of 3")).toBeVisible();
  await expect(page.locator('[data-check="hvac.designer_declaration.individual_bcin"]')).toHaveCount(1);
  await upload("Schedule_1.pdf", form); // the same Ontario PDF holds Schedule 1: not a duplicate
  await expect(page.getByText("Confirm which version should be included")).toHaveCount(0);
  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByText("Document 3 of 3")).toBeVisible();
  await expect(page.locator('[data-check="hvac.heat_designer.signature"]')).toHaveCount(1);
  await upload("Heat_Loss_Gain_Summary.pdf", other);
  await page.getByRole("button", { name: /^Next/ }).click();

  await page.waitForURL("**/declaration");
  await expect(page.locator('input[type="checkbox"][required]')).toHaveCount(3); // declare, signed, Schedule 1 designer
  await declare(page);
  await expect(page.getByRole("heading", { name: "Unfinished items (0)" })).toBeVisible();
  await expect(page.getByText("3 of 3")).toBeVisible();
});
