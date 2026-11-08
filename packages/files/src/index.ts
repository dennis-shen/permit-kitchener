/**
 * @permit/files — instant browser-side file checks + client for POST /api/review.
 * Server-side checks (encryption, signatures, addresses, drawing content) will come from the review service (services/review).
 */
import {
  FILE_FINDING_MESSAGES,
  type FileFindingCode,
  type Finding,
  ReviewResponse,
  type ReviewRequest,
} from "@permit/schema";

export interface UploadFile {
  name: string;
  bytes: Uint8Array;
  mimeType?: string;
}

export type ReviewResult =
  | ({ reviewUnavailable: false } & ReviewResponse)
  | { reviewUnavailable: true; reason: string; findings: Finding[] };

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 30;

const VAGUE = /^(scan|img|image|doc|document|file|untitled|new|page|copy)[\s_-]*\d*$|^\d+$/i;

export function sniff(bytes: Uint8Array): "pdf" | "image" | "other" {
  const head = String.fromCharCode(...bytes.slice(0, 8));
  if (head.startsWith("%PDF-")) return "pdf";
  if (bytes[0] === 0x89 && head.slice(1, 4) === "PNG") return "image";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image";
  return "other";
}

export function isVagueName(name: string): boolean {
  return VAGUE.test(name.replace(/\.[a-z0-9]+$/i, "").trim());
}

export function normalisedName(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/\s*\(\d+\)$|[\s_-]*(copy|final|v\d+)$/, "")
    .replace(/[^a-z0-9]/g, "");
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fileFinding(code: FileFindingCode, filename: string, quote?: string): Finding {
  return {
    id: `file:${code}:${filename}`,
    category: code === "WRONG_FORMAT" ? "wrong" : "unclear",
    severity: code === "WRONG_FORMAT" ? "blocker" : "warning",
    fileCode: code,
    message: FILE_FINDING_MESSAGES[code],
    evidence: [{ filename, page: 1, expectedRegion: false, confidence: 1, source: "rule", quote: quote ?? filename }],
  };
}

/** Instant checks that need no server: format, duplicates, vague filenames, size. */
export async function precheckFiles(files: UploadFile[]): Promise<Finding[]> {
  const out: Finding[] = [];
  const seen = new Map<string, string>();
  for (const f of files) {
    if (f.bytes.byteLength > MAX_FILE_BYTES) {
      out.push({ ...fileFinding("UNREADABLE", f.name), message: "This file is larger than 20 MB. Upload a smaller copy." });
      continue;
    }
    const kind = sniff(f.bytes);
    if (kind === "other" && !/\.pdf$/i.test(f.name)) out.push(fileFinding("WRONG_FORMAT", f.name));
    if (isVagueName(f.name)) out.push(fileFinding("UNCLEAR_NAME", f.name));
    for (const key of [await sha256(f.bytes), `n:${normalisedName(f.name)}`]) {
      const prev = seen.get(key);
      if (prev) {
        out.push(fileFinding("DUPLICATE", f.name, `Same as ${prev}`));
        break;
      }
    }
    seen.set(await sha256(f.bytes), f.name);
    if (!seen.has(`n:${normalisedName(f.name)}`)) seen.set(`n:${normalisedName(f.name)}`, f.name);
  }
  return out;
}

/** POST files + application to the review endpoint. Never throws on network failure. */
export async function reviewFiles(
  files: UploadFile[],
  req: ReviewRequest,
  opts: { endpoint?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<ReviewResult> {
  const endpoint = opts.endpoint ?? "/api/review";
  const doFetch = opts.fetchImpl ?? fetch;
  const form = new FormData();
  for (const f of files) form.append("files", new Blob([f.bytes as Uint8Array<ArrayBuffer>], { type: f.mimeType ?? "application/octet-stream" }), f.name);
  form.append("submission", JSON.stringify(req));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000);
  try {
    const res = await doFetch(endpoint, { method: "POST", body: form, signal: ctrl.signal });
    if (!res.ok) throw new Error(`review failed (${res.status})`);
    return { reviewUnavailable: false, ...ReviewResponse.parse(await res.json()) };
  } catch (e) {
    return {
      reviewUnavailable: true,
      reason: e instanceof Error ? e.message : String(e),
      findings: await precheckFiles(files),
    };
  } finally {
    clearTimeout(timer);
  }
}
