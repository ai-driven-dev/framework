import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseToml } from "../../src/contexts/tools/domain/profiles/codex/toml.js";
import { parseFrontmatter } from "../../src/kernel/markdown.js";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { createTestEnv, runCli } from "./helpers.js";

const roles = ["explorer", "executor", "validator", "reviewer"];
const cases = [
  ["claude-code", "anthropic", ".claude", ".md", { model: "claude-haiku-5-5", effort: "medium" }],
  ["codex", "openai", ".codex", ".toml", { model: "gpt-6-luna", model_reasoning_effort: "medium" }],
  ["copilot", "openai", ".github", ".agent.md", { model: "gpt-6-luna", reasoningEffort: "medium" }],
  [
    "copilot",
    "anthropic",
    ".github",
    ".agent.md",
    { model: "claude-haiku-5.5", reasoningEffort: "medium" },
  ],
  ["opencode", "openai", ".opencode", ".md", { model: "openai/gpt-6-luna#medium" }],
  ["opencode", "anthropic", ".opencode", ".md", { model: "anthropic/claude-haiku-5-5#medium" }],
  ["opencode", "mistral", ".opencode", ".md", { model: "mistral/mistral-small-2603#high" }],
  ["cursor", "anthropic", ".cursor", ".md", { model: "claude-haiku-5-5[effort=medium]" }],
] as const;

describe.concurrent("explicit native agent installation", () => {
  for (const [ide, provider, directory, suffix, expected] of cases) {
    it(`${ide} installs the four agents with ${provider} headers, then removes them`, async () => {
      const box = await createTestEnv(`agents-${ide}-${provider}`);
      try {
        const result = await runCli(
          ["agents", "install", "--provider", provider, "--ide", ide],
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
            ide === "codex" ? parseToml(content) : parseFrontmatter(content).frontmatter;
          expect(fields).toMatchObject(expected);
          if (ide === "opencode") expect(fields.mode).toBe("subagent");
          else expect(fields.name).toBe(`aidd-dev-${role}`);
          expect(content).toContain("# Behavior");
        }
        const repeated = await runCli(
          ["agents", "install", "--provider", provider, "--ide", ide],
          box.projectDir,
          box.fakeHome
        );
        expect(repeated.exitCode, repeated.stderr).toBe(0);
        const removed = await runCli(
          ["agents", "remove", "--ide", ide],
          box.projectDir,
          box.fakeHome
        );
        expect(removed.exitCode, removed.stderr).toBe(0);
        for (const role of roles)
          await expect(
            access(join(box.projectDir, directory, "agents", `aidd-dev-${role}${suffix}`))
          ).rejects.toThrow();
      } finally {
        await box.cleanup();
      }
    });
  }

  it.each([
    ["--ide", "codex"],
    ["--provider", "openai"],
    ["--provider", "anthropic", "--ide", "codex"],
    ["--provider", "openai", "--ide", "claude-code"],
    ["--provider", "mistral", "--ide", "codex"],
    ["--provider", "unknown", "--ide", "codex"],
    ["--provider", "openai", "--ide", "unknown"],
  ])("rejects missing or unsupported selection: %s %s", async (...args) => {
    const box = await createTestEnv("agents-invalid");
    try {
      const result = await runCli(["agents", "install", ...args], box.projectDir, box.fakeHome);
      expect(result.exitCode).toBe(1);
      await expect(access(join(box.projectDir, ".aidd", "agents.json"))).rejects.toThrow();
    } finally {
      await box.cleanup();
    }
  });

  it("refuses a personal-file collision before installing any agent", async () => {
    const box = await createTestEnv("agents-collision");
    try {
      const directory = join(box.projectDir, ".codex", "agents");
      await mkdir(directory, { recursive: true });
      const personal = join(directory, "aidd-dev-reviewer.toml");
      await writeFile(personal, "personal agent\n");
      const result = await runCli(
        ["agents", "install", "--provider", "openai", "--ide", "codex"],
        box.projectDir,
        box.fakeHome
      );
      expect(result.exitCode).toBe(1);
      expect(await readFile(personal, "utf8")).toBe("personal agent\n");
      await expect(access(join(directory, "aidd-dev-explorer.toml"))).rejects.toThrow();
    } finally {
      await box.cleanup();
    }
  });

  it("switches provider explicitly and preserves unrelated personal agents", async () => {
    const box = await createTestEnv("agents-provider-switch");
    try {
      const directory = join(box.projectDir, ".opencode", "agents");
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "personal.md"), "personal agent\n");
      for (const provider of ["openai", "anthropic", "mistral"]) {
        const result = await runCli(
          ["agents", "install", "--provider", provider, "--ide", "opencode"],
          box.projectDir,
          box.fakeHome
        );
        expect(result.exitCode, result.stderr).toBe(0);
      }
      for (const role of roles) {
        const content = await readFile(join(directory, `aidd-dev-${role}.md`), "utf8");
        expect(parseFrontmatter(content).frontmatter.model).toBe("mistral/mistral-small-2603#high");
      }
      const removed = await runCli(
        ["agents", "remove", "--ide", "opencode"],
        box.projectDir,
        box.fakeHome
      );
      expect(removed.exitCode, removed.stderr).toBe(0);
      expect(await readFile(join(directory, "personal.md"), "utf8")).toBe("personal agent\n");
    } finally {
      await box.cleanup();
    }
  });

  it("clean previews then removes opted-in agents without requiring framework setup", async () => {
    const box = await createTestEnv("agents-clean");
    try {
      const installed = await runCli(
        ["agents", "install", "--provider", "openai", "--ide", "codex"],
        box.projectDir,
        box.fakeHome
      );
      expect(installed.exitCode, installed.stderr).toBe(0);
      const directory = join(box.projectDir, ".codex", "agents");
      const preview = await runCli(["clean"], box.projectDir, box.fakeHome);
      expect(preview.exitCode, preview.stderr).toBe(0);
      await access(join(directory, "aidd-dev-explorer.toml"));
      const cleaned = await runCli(["clean", "--force"], box.projectDir, box.fakeHome);
      expect(cleaned.exitCode, cleaned.stderr).toBe(0);
      for (const role of roles)
        await expect(access(join(directory, `aidd-dev-${role}.toml`))).rejects.toThrow();
      await expect(access(join(box.projectDir, ".aidd", "agents.json"))).rejects.toThrow();
    } finally {
      await box.cleanup();
    }
  });

  it("framework distribution contains no opt-in agents", async () => {
    const box = await createTestEnv("agents-default");
    try {
      const output = join(box.tempDir, "built");
      const result = await runCli(
        ["translate", REPOSITORY_ROOT, "--to", "claude", "--out", output],
        box.projectDir,
        box.fakeHome
      );
      expect(result.exitCode, result.stderr).toBe(0);
      const plugin = join(output, "plugins", "aidd-dev");
      const manifest = JSON.parse(
        await readFile(join(plugin, ".claude-plugin", "plugin.json"), "utf8")
      );
      expect(manifest).not.toHaveProperty("agents");
      await expect(access(join(plugin, "agents"))).rejects.toThrow();
    } finally {
      await box.cleanup();
    }
  });
});
