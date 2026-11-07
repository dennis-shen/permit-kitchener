import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISCLAIMER, FORBIDDEN_PHRASES } from "@permit/schema";

const ROOT = join(__dirname, "../..");
function walk(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === "node_modules" || n === ".next" || n === "public") return [];
    return statSync(p).isDirectory() ? walk(p, exts) : exts.some((e) => p.endsWith(e)) ? [p] : [];
  });
}

describe("never-approve policy", () => {
  const files = [...walk(join(ROOT, "apps/web"), [".tsx", ".ts"]), ...walk(join(ROOT, "data"), [".json"])];
  it.each(files.map((f) => [f.replace(ROOT + "/", ""), f]))("%s has no approval language outside the disclaimer", (_n, f) => {
    const text = readFileSync(f as string, "utf8").replaceAll(DISCLAIMER, "").toLowerCase();
    for (const p of FORBIDDEN_PHRASES) expect(text.includes(p), `"${p}"`).toBe(false);
  });
});
