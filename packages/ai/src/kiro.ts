import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { z } from "zod";
import {
  DecisionRequest,
  decisionSchema,
  requirementsForDocument,
  questionsForDocument,
  SYSTEM,
} from "./decisions";

export const ReviewConfig = z
  .object({
    backend: z.enum(["kiro", "gateway"]).default("kiro"),
    kiroExecutable: z.string().min(1).optional(),
    kiroModel: z.string().min(1).optional(),
  })
  .strict();
export type ReviewConfig = z.infer<typeof ReviewConfig>;
export async function reviewConfig(): Promise<ReviewConfig> {
  return ReviewConfig.parse(
    JSON.parse(await readFile(new URL("../../../data/ai-review.json", import.meta.url), "utf8")),
  );
}
export function kiroCommand(config: ReviewConfig, platform = process.platform) {
  return {
    executable: config.kiroExecutable ?? (platform === "win32" ? "kiro-cli.exe" : "kiro-cli"),
    args: [
      "chat",
      "--v3",
      "--no-interactive",
      "--agent",
      "permit-review",
      ...(config.kiroModel ? ["--model", config.kiroModel] : []),
    ],
  };
}
const BEGIN = "BEGIN_PERMIT_DECISIONS";
const END = "END_PERMIT_DECISIONS";
export function parseKiroOutput(text: string, input: DecisionRequest): Record<string, boolean> {
  const frames = [
    ...stripVTControlCharacters(text).matchAll(
      /^(?:>\s*)?BEGIN_PERMIT_DECISIONS\s*\r?\n([\s\S]*?)\r?\nEND_PERMIT_DECISIONS\s*$/gm,
    ),
  ];
  if (frames.length !== 1) throw new Error("Kiro did not return one decision result.");
  return decisionSchema(questionsForDocument(input)).parse(JSON.parse(frames[0]![1]!));
}
export interface KiroRun {
  executable: string;
  args: string[];
  cwd: string;
  prompt: string;
  signal: AbortSignal;
}
export function runKiroProcess(run: KiroRun): Promise<string> {
  return new Promise((resolve, reject) => {
    // The prompt goes over stdin, never shell interpolation or a command-line argument.
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1" };
    delete env.AI_GATEWAY_API_KEY;
    const child = spawn(run.executable, run.args, {
      cwd: run.cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      signal: run.signal,
    });
    let output = "";
    let bytes = 0;
    let failed = false;
    const fail = () => {
      failed = true;
      child.kill();
      reject(new Error("Kiro document review failed."));
    };
    child.on("error", () => {
      failed = true;
      reject(new Error("Kiro CLI could not run. Check installation and authentication."));
    });
    child.stdin.on("error", fail);
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) fail();
      else output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) fail();
    });
    child.on("close", (code) => {
      if (!failed) {
        if (code === 0) resolve(output);
        else reject(new Error("Kiro document review failed."));
      }
    });
    child.stdin.end(run.prompt);
  });
}
export async function decideKiro(
  input: DecisionRequest,
  config: ReviewConfig,
  signal?: AbortSignal,
  run = runKiroProcess,
): Promise<Record<string, boolean>> {
  const dir = await mkdtemp(join(tmpdir(), "permit-review-"));
  try {
    const images = input.images.map((_, i) => join(dir, `page-${i + 1}.png`));
    await Promise.all(
      images.map((path, i) =>
        writeFile(path, Buffer.from(input.images[i]!, "base64"), { mode: 0o600 }),
      ),
    );
    const agentDir = join(dir, ".kiro", "agents");
    await mkdir(agentDir, { recursive: true });
    const allowed = images.map((p) => p.replaceAll("\\", "/"));
    await writeFile(
      join(agentDir, "permit-review.json"),
      JSON.stringify({
        name: "permit-review",
        description: "Read-only visual permit document decisions",
        prompt: SYSTEM,
        tools: ["read"],
        excludedTools: ["knowledge"],
        resources: [],
        includeMcpJson: false,
        includePowers: false,
        mcpServers: {},
        hooks: [],
        permissions: {
          rules: [
            { capability: "fs_read", match: allowed, effect: "allow" },
            { capability: "fs_read", match: ["**"], exclude: allowed, effect: "deny" },
          ],
        },
      }),
      { mode: 0o600 },
    );
    const questions = questionsForDocument(input);
    const prompt =
      `${SYSTEM}\nVisually open EVERY listed PNG using image reading, in listed page order. Do not use OCR, text extraction, shell commands, other files, or subagents. If any image cannot be inspected, fail instead of guessing. These are consecutive pages of the same uploaded PDF; continue table headings and columns onto the next page. A label alone is not a filled assembly. Blank optional styles do not invalidate another filled style.\n` +
      JSON.stringify({
        project_type: input.project_type,
        document_type: input.document_type,
        expected_project_address: input.expected_address,
        applicable_requirements: requirementsForDocument(input),
        questions,
        output_schema: z.toJSONSchema(decisionSchema(questions)),
        page_images_in_order: images,
      }) +
      `\nReturn only the requested boolean object. Start the final answer with a line containing ${BEGIN}, then the JSON object, then a line containing ${END}. No values, quotes, identifiers, explanations or markdown fences.`;
    const command = kiroCommand(config);
    const timeout = AbortSignal.timeout(60_000);
    const output = await run({
      ...command,
      cwd: dir,
      prompt,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    return parseKiroOutput(output, input);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
