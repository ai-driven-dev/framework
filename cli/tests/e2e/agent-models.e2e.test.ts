import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseToml } from "../../src/contexts/tools/domain/profiles/codex/toml.js";
import { parseFrontmatter } from "../../src/kernel/markdown.js";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { createTestEnv, runCli } from "./helpers.js";

const roles = ["explorer", "executor", "validator", "reviewer"];
const hosts = [
  ["claude", ".claude", ".md", { model: "claude-haiku-5-5", effort: "medium" }],
  ["codex", ".codex", ".toml", { model: "gpt-6-luna", model_reasoning_effort: "medium" }],
  ["copilot", ".github", ".agent.md", { model: "gpt-6-luna", reasoningEffort: "medium" }],
  ["opencode", ".opencode", ".md", { model: "openai/gpt-6-luna#medium" }],
  ["cursor", ".cursor", ".md", { model: "claude-haiku-5-5[effort=medium]" }],
] as const;

async function source(root: string): Promise<string> {
  const path = join(root, "source");
  const plugin = join(path, "plugins", "aidd-dev");
  await mkdir(join(path, ".claude-plugin"), { recursive: true });
  await mkdir(join(plugin, ".claude-plugin"), { recursive: true });
  await mkdir(join(plugin, "agents"));
  await writeFile(
    join(path, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "agent-model-tests",
      owner: { name: "Test" },
      plugins: [{ name: "aidd-dev", source: "./plugins/aidd-dev" }],
    })
  );
  await writeFile(
    join(plugin, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "aidd-dev", version: "1.0.0", description: "Agent models" })
  );
  for (const role of roles)
    await copyFile(
      join(REPOSITORY_ROOT, "plugins", "aidd-dev", "agents", `${role}.md`),
      join(plugin, "agents", `${role}.md`)
    );
  return path;
}

describe.concurrent("CLI-installed agent model headers", () => {
  for (const [host, directory, suffix, expected] of hosts) {
    it(`${host} writes all four agents into the host's native flat directory`, async () => {
      const box = await createTestEnv(`agent-models-${host}`);
      try {
        const input = await source(box.tempDir);
        const result = await runCli(
          ["translate", input, "--to", host, "--as", "flat", "--out", box.projectDir],
          box.projectDir,
          box.fakeHome
        );
        expect(result.exitCode, result.stderr).toBe(0);
        for (const role of roles) {
          const content = await readFile(
            join(box.projectDir, directory, "agents", `aidd-dev-${role}${suffix}`),
            "utf8"
          );
          const fields =
            host === "codex" ? parseToml(content) : parseFrontmatter(content).frontmatter;
          expect(fields).toMatchObject(expected);
          expect(content).toContain("# Behavior");
        }
      } finally {
        await box.cleanup();
      }
    });

    if (host === "opencode") continue;
    it(`${host} marketplace output respects the native agent format`, async () => {
      const box = await createTestEnv(`agent-models-${host}-plugin`);
      try {
        const input = await source(box.tempDir);
        const output = join(box.tempDir, "built");
        const result = await runCli(
          ["translate", input, "--to", host, "--out", output],
          box.projectDir,
          box.fakeHome
        );
        expect(result.exitCode, result.stderr).toBe(0);
        for (const role of roles) {
          const content = await readFile(
            join(
              output,
              "plugins",
              "aidd-dev",
              host === "codex" ? "codex-agents" : "agents",
              `${role}${host === "codex" ? ".toml" : ".md"}`
            ),
            "utf8"
          );
          const fields =
            host === "codex" ? parseToml(content) : parseFrontmatter(content).frontmatter;
          if (host === "cursor") expect(fields).not.toHaveProperty("model");
          else expect(fields).toMatchObject(expected);
        }
      } finally {
        await box.cleanup();
      }
    });
  }
});
