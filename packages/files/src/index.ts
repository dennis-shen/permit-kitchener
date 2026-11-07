/** @permit/files — OWNER: Kiro-2. Browser-side cheap checks + client for /api/review. See docs/CONTRACTS.md §4. */
import type { Finding, VisionReviewRequest, VisionReviewResponse } from "@permit/schema";

export interface UploadFile { name: string; bytes: Uint8Array; mimeType?: string }

export type ReviewResult =
  | ({ visionUnavailable: false } & VisionReviewResponse)
  | { visionUnavailable: true; findings: Finding[] };

/** Instant checks that need no server: format, size, duplicate, vague filename. */
export async function precheckFiles(_files: UploadFile[]): Promise<Finding[]> {
  throw new Error("not implemented");
}

/** Prechecks + POST /api/review. Never throws on network failure: returns visionUnavailable. */
export async function reviewFiles(_files: UploadFile[], _req: VisionReviewRequest): Promise<ReviewResult> {
  throw new Error("not implemented");
}
