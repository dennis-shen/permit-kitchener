/**
 * Builds the downloadable PDF summary: application details, result, and every missing item with
 * where to add it and where to find guidance. Runs in the browser with pdf-lib (no server needed).
 */
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { DISCLAIMER, type ApplicationInfo, type ReadinessReport } from "@permit/schema";

const GREEN = rgb(0, 77 / 255, 68 / 255);
const GREEN_TINT = rgb(0.92, 0.96, 0.95);
const RED = rgb(0.6, 0.1, 0.08);
const RED_TINT = rgb(0.99, 0.93, 0.92);
const GREY = rgb(0.35, 0.35, 0.35);
const RULE = rgb(0.8, 0.8, 0.8);
const BLACK = rgb(0, 0, 0);

const W = 612; // US Letter
const H = 792;
const M = 48; // margin
const FOOTER = 64; // reserved at the bottom of every page

export interface OutstandingItem {
  requirement: string;
  message: string;
  whereToAdd: string;
  reference?: { label: string; url: string };
  file?: string;
}

/** Make a rectangle on the page a clickable web link. */
function addLink(doc: PDFDocument, page: PDFPage, x: number, y: number, w: number, h: number, url: string) {
  const annot = doc.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [x, y, x + w, y + h], Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  });
  const ref = doc.context.register(annot);
  const existing = page.node.lookup(PDFName.of("Annots"));
  if (existing && "push" in existing) (existing as unknown as { push: (r: unknown) => void }).push(ref);
  else page.node.set(PDFName.of("Annots"), doc.context.obj([ref]));
}

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

export interface SummaryInput {
  application: ApplicationInfo;
  report: ReadinessReport | null;
  projectLabel: string;
  permitLine: string;
  resultLabel: string;
  resultText: string;
  outstanding: OutstandingItem[];
  complete: string[];
  generatedOn: string;
}

/** pdf-lib's standard fonts use WinAnsi; replace anything they cannot draw. */
const REPLACE: Record<number, string> = {
  0x2018: "'", 0x2019: "'", 0x201c: '"', 0x201d: '"', 0x2013: "-", 0x2014: "-", 0x2026: "...", 0x2260: "does not match", 0x00a0: " ",
};

function clean(t: string): string {
  let out = "";
  for (const ch of t) {
    const c = ch.codePointAt(0)!;
    if (REPLACE[c] !== undefined) out += REPLACE[c];
    else if (c === 10) out += "\n";
    else if (c === 9 || c === 13) out += " ";
    else if ((c >= 32 && c <= 126) || (c >= 161 && c <= 255)) out += ch; // drawable in WinAnsi
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const raw of para.split(/\s+/)) {
      let word = raw;
      // break very long tokens (URLs) at character level
      while (font.widthOfTextAtSize(word, size) > width) {
        let i = word.length;
        while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > width) i--;
        if (line) { out.push(line); line = ""; }
        out.push(word.slice(0, i));
        word = word.slice(i);
      }
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) { out.push(line); line = word; }
      else line = next;
    }
    out.push(line);
  }
  return out;
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(public doc: PDFDocument, public font: PDFFont, public bold: PDFFont) { this.newPage(); }

  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
  }
  ensure(h: number) {
    if (this.y - h < FOOTER) this.newPage();
  }
  text(t: string, opts: { size?: number; bold?: boolean; color?: RGB; x?: number; width?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const f = opts.bold ? this.bold : this.font;
    const x = opts.x ?? M;
    const lines = wrap(t, f, size, opts.width ?? W - M - x);
    for (const l of lines) {
      this.ensure(size + 4);
      this.page.drawText(l, { x, y: this.y - size, size, font: f, color: opts.color ?? BLACK });
      this.y -= size + 4;
    }
    this.y -= opts.gap ?? 0;
  }
  heading(t: string) {
    this.ensure(40);
    this.y -= 10;
    this.page.drawText(clean(t), { x: M, y: this.y - 13, size: 13, font: this.bold, color: GREEN });
    this.y -= 19;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 1.2, color: GREEN });
    this.y -= 8;
  }
}

/** What the uploaded application form showed for one field. */
function formStatus(report: ReadinessReport | null, detailId: string): string {
  const item = report?.items.find((i) => i.requirementId === "general.application");
  if (!item || item.status === "missing") return "Application form not uploaded";
  return item.issues.some((i) => i.detailId === detailId) ? "Not found" : "Found";
}

export async function buildSummaryPdf(input: SummaryInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Building permit application summary - ${input.application.application_id}`);
  doc.setSubject("Preliminary application readiness summary");
  doc.setCreator("Permit Checker");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold);
  const a = input.application;

  // ── Title band
  w.page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: GREEN });
  w.page.drawText("Building Permit Application Summary", { x: M, y: H - 48, size: 20, font: bold, color: rgb(1, 1, 1) });
  w.page.drawText(clean(`${input.projectLabel}  |  ${a.property_address || "Address not provided"}`), { x: M, y: H - 70, size: 10.5, font, color: rgb(1, 1, 1) });
  w.page.drawText(clean(`Prepared ${input.generatedOn}  |  Reference ${a.application_id}`), { x: M, y: H - 84, size: 8.5, font, color: rgb(0.85, 0.93, 0.91) });
  w.y = H - 92 - 18;

  // ── Application information (two-column key/value grid)
  w.heading("Application information");
  const rows: [string, string][] = [
    ["Applicant", a.applicant_organisation ? `${a.applicant_organisation} (${a.applicant_name})` : a.applicant_name || "-"],
    ["Applicant role", a.applicant_role || "-"],
    ["Property address", a.property_address || "-"],
    ["Project type", input.projectLabel],
    ["Estimated construction value", a.estimated_construction_value ? `$${a.estimated_construction_value.toLocaleString("en-CA")}` : "-"],
    ["Application date", a.submission_date || "-"],
    ["Declaration (confirmed in this checker)", a.declaration_completed ? "Yes" : "No"],
    ["Signature on uploaded form", formStatus(input.report, "general.application.signature_present")],
  ];
  const colW = (W - 2 * M) / 2;
  for (let i = 0; i < rows.length; i += 2) {
    const pair = rows.slice(i, i + 2);
    const heights = pair.map(([, v]) => wrap(v, font, 10, colW - 12).length * 14 + 16);
    const h = Math.max(...heights);
    w.ensure(h);
    pair.forEach(([k, v], j) => {
      const x = M + j * colW;
      w.page.drawText(clean(k.toUpperCase()), { x: x + 6, y: w.y - 10, size: 7, font: bold, color: GREY });
      wrap(v, font, 10, colW - 12).forEach((l, n) => w.page.drawText(l, { x: x + 6, y: w.y - 23 - n * 14, size: 10, font, color: BLACK }));
    });
    w.y -= h;
    w.page.drawLine({ start: { x: M, y: w.y + 3 }, end: { x: W - M, y: w.y + 3 }, thickness: 0.5, color: RULE });
  }
  w.y -= 4;
  w.text("Project description", { size: 7, bold: true, color: GREY, x: M + 6 });
  w.text(a.project_description || "-", { size: 10, x: M + 6, width: W - 2 * M - 12, gap: 6 });

  // ── Result box
  const resultLines = wrap(input.resultText, font, 10, W - 2 * M - 28);
  const permitLines = wrap(input.permitLine, font, 10, W - 2 * M - 28);
  const boxH = 30 + (resultLines.length + permitLines.length) * 14 + 8;
  w.ensure(boxH + 12);
  w.y -= 8;
  const ready = input.report?.readiness === "appears_ready";
  w.page.drawRectangle({ x: M, y: w.y - boxH, width: W - 2 * M, height: boxH, color: ready ? GREEN_TINT : RED_TINT, borderColor: ready ? GREEN : RED, borderWidth: 1.5 });
  w.page.drawRectangle({ x: M, y: w.y - boxH, width: 6, height: boxH, color: ready ? GREEN : RED });
  w.page.drawText(clean(input.resultLabel), { x: M + 16, y: w.y - 22, size: 15, font: bold, color: ready ? GREEN : RED });
  let yy = w.y - 40;
  for (const l of [...resultLines, ...permitLines]) { w.page.drawText(l, { x: M + 16, y: yy, size: 10, font }); yy -= 14; }
  w.y -= boxH + 6;

  // ── Outstanding items table
  w.heading(`Missing or incomplete items (${input.outstanding.length})`);
  if (input.outstanding.length === 0) {
    w.text("No missing items were identified using the simplified requirements.", { gap: 4 });
  } else {
    const cols = [{ t: "#", w: 22 }, { t: "Requirement", w: 110 }, { t: "What is missing", w: 170 }, { t: "Where to add it", w: W - 2 * M - 22 - 110 - 170 }];
    const drawHeader = () => {
      w.ensure(22);
      w.page.drawRectangle({ x: M, y: w.y - 18, width: W - 2 * M, height: 18, color: GREEN });
      let x = M;
      for (const c of cols) { w.page.drawText(c.t, { x: x + 5, y: w.y - 13, size: 8.5, font: bold, color: rgb(1, 1, 1) }); x += c.w; }
      w.y -= 18;
    };
    drawHeader();
    input.outstanding.forEach((it, i) => {
      type Cell = { t: string; small?: boolean }[];
      const plain = (t: string, f: PDFFont, width: number): Cell => wrap(t, f, 8.5, width).map((x) => ({ t: x }));
      const cells: Cell[] = [
        [{ t: String(i + 1) }],
        plain(it.requirement, bold, cols[1]!.w - 10),
        plain(it.message + (it.file ? ` (File: ${it.file})` : ""), font, cols[2]!.w - 10),
        [
          ...plain(it.whereToAdd, font, cols[3]!.w - 10),
          ...(it.reference ? wrap(`Guidance: ${it.reference.label} (${host(it.reference.url)})`, font, 7.5, cols[3]!.w - 10).map((x) => ({ t: x, small: true })) : []),
        ],
      ];
      const h = Math.max(...cells.map((c) => c.length)) * 11.5 + 10;
      if (w.y - h < FOOTER) { w.newPage(); drawHeader(); }
      if (i % 2 === 1) w.page.drawRectangle({ x: M, y: w.y - h, width: W - 2 * M, height: h, color: rgb(0.97, 0.97, 0.97) });
      let x = M;
      cells.forEach((c, ci) => {
        c.forEach((l, n) => {
          const ty = w.y - 13 - n * 11.5;
          w.page.drawText(l.t, { x: x + 5, y: ty, size: l.small ? 7.5 : 8.5, font: ci === 1 ? bold : font, color: l.small ? GREEN : BLACK });
          if (l.small && it.reference) {
            const lw = font.widthOfTextAtSize(l.t, 7.5);
            w.page.drawLine({ start: { x: x + 5, y: ty - 1 }, end: { x: x + 5 + lw, y: ty - 1 }, thickness: 0.4, color: GREEN });
            addLink(doc, w.page, x + 5, ty - 2, lw, 9.5, it.reference.url);
          }
        });
        x += cols[ci]!.w;
      });
      w.y -= h;
      w.page.drawLine({ start: { x: M, y: w.y }, end: { x: W - M, y: w.y }, thickness: 0.5, color: RULE });
    });
  }

  // ── Complete items
  if (input.complete.length) {
    w.heading("Requirements that appear complete");
    for (const c of input.complete) w.text(`-  ${c}`, { size: 9.5, x: M + 6 });
  }

  // ── Next steps
  w.heading("Next steps");
  [
    "1. Update your forms and drawings for each item listed above.",
    "2. Run the check again with the revised files.",
    "3. Apply through the City of Kitchener's online application process. City staff review the application and make the final decision.",
  ].forEach((s) => w.text(s, { size: 9.5, x: M + 6 }));

  // ── Footer on every page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: FOOTER - 8 }, end: { x: W - M, y: FOOTER - 8 }, thickness: 0.5, color: RULE });
    wrap(DISCLAIMER, font, 7, W - 2 * M - 70).forEach((l, n) => p.drawText(l, { x: M, y: FOOTER - 20 - n * 9, size: 7, font, color: GREY }));
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: W - M - 50, y: FOOTER - 20, size: 7.5, font, color: GREY });
  });

  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const el = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(el);
  el.click();
  el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
