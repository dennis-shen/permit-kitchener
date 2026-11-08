import { describe, it, expect } from "vitest";
import { readFile, access } from "node:fs/promises";
import { DecisionRequest, questionsForDocument } from "./decisions";
import { ReviewConfig, kiroCommand, parseKiroOutput, decideKiro, runKiroProcess } from "./kiro";
const input = DecisionRequest.parse({
  project_type: "hvac_system",
  document_type: "heat_loss_gain",
  images: ["iVBORw0KGgo=", "iVBORw0KGgo="],
});
const answers = Object.fromEntries(
  Object.keys(questionsForDocument(input)).map((id) => [
    id,
    id === "hvac.heat_construction.exposed_floors" ||
      id === "hvac.heat_construction.exterior_doors",
  ]),
);
const framed = (value: unknown) =>
  `CLI progress\nBEGIN_PERMIT_DECISIONS\n${JSON.stringify(value)}\nEND_PERMIT_DECISIONS\n`;
describe("Kiro CLI review", () => {
  it("defaults to Kiro and uses native Windows executables without a shell", () => {
    expect(ReviewConfig.parse({}).backend).toBe("kiro");
    expect(kiroCommand(ReviewConfig.parse({}), "win32").executable).toBe("kiro-cli.exe");
    expect(
      kiroCommand(
        ReviewConfig.parse({ kiroExecutable: "C:\\Program Files\\Kiro\\kiro-cli.exe" }),
        "win32",
      ).executable,
    ).toContain("Program Files");
    expect(ReviewConfig.parse({ backend: "gateway" }).backend).toBe("gateway");
  });
  it("accepts only one exact boolean result, not CLI chatter or extracted values", () => {
    expect(parseKiroOutput(framed(answers), input)).toEqual(answers);
    for (const bad of [
      framed({}),
      framed({ ...answers, field_value: "private" }),
      framed({ ...answers, [Object.keys(answers)[0]!]: "true" }),
      framed(answers) + framed(answers),
      "No result",
    ])
      expect(() => parseKiroOutput(bad, input)).toThrow();
  });
  it("provides both page images and requirement JSON and removes the isolated workspace", async () => {
    let cwd = "";
    const result = await decideKiro(input, ReviewConfig.parse({}), undefined, async (run) => {
      cwd = run.cwd;
      expect(run.args).toContain("--no-interactive");
      expect(run.args).not.toContain("--trust-all-tools");
      expect(run.prompt).toContain("hvac.heat_construction.exposed_floors");
      expect(run.prompt).toContain("applicable_requirements");
      expect(run.prompt).toContain("across page breaks");
      for (const n of [1, 2])
        expect((await readFile(`${cwd}/page-${n}.png`)).subarray(0, 4).toString("hex")).toBe(
          "89504e47",
        );
      const agent = JSON.parse(await readFile(`${cwd}/.kiro/agents/permit-review.json`, "utf8"));
      expect(agent.tools).toEqual(["read"]);
      expect(agent.includeMcpJson).toBe(false);
      expect(agent.permissions.rules[0].match).toHaveLength(2);
      return framed(answers);
    });
    expect(result).toEqual(answers);
    await expect(access(cwd)).rejects.toThrow();
  });
  it("cleans up on CLI failure and never returns partial positive decisions", async () => {
    let cwd = "";
    await expect(
      decideKiro(input, ReviewConfig.parse({}), undefined, async (run) => {
        cwd = run.cwd;
        throw new Error("Unavailable");
      }),
    ).rejects.toThrow();
    await expect(access(cwd)).rejects.toThrow();
  });
  it("pipes a prompt over stdin and rejects a failed command even if it prints valid-looking output", async () => {
    const signal = AbortSignal.timeout(5000);
    const base = {
      executable: process.execPath,
      cwd: process.cwd(),
      prompt: "document prompt",
      signal,
    };
    expect(
      await runKiroProcess({
        ...base,
        args: ["-e", "process.stdin.on('data',b=>process.stdout.write(b))"],
      }),
    ).toBe("document prompt");
    await expect(
      runKiroProcess({ ...base, args: ["-e", "console.log('true');process.exit(1)"] }),
    ).rejects.toThrow("Kiro document review failed");
  });
});
