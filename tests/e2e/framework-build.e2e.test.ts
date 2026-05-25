import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

async function hashDirectory(dir: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!existsSync(dir)) return result;
  const entries = await readdir(dir, { recursive: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      const content = await readFile(fullPath);
      result.set(entry, createHash("md5").update(content).digest("hex"));
    } catch {
      // skip directories (EISDIR) or missing paths
    }
  }
  return result;
}

describe.concurrent("E2E: aidd framework build", () => {
  it("AC #1 + #4: build → marketplace add → plugin install runs without error", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-build-install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["ai", "install", "copilot"], projectDir, fakeHome);

      const outDir = join(tempDir, "dist");
      const build = await runCli(
        ["framework", "build", "--source", FRAMEWORK_PATH, "--target", "copilot", "--out", outDir],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);
      expect(build.stdout).toContain("Built");
      expect(build.stdout).toContain("files written to");

      // AC #1: verify Copilot-native layout
      const marketplacePath = join(outDir, ".github", "plugin", "marketplace.json");
      expect(existsSync(marketplacePath)).toBe(true);

      const addMarket = await runCli(
        ["marketplace", "add", "fw-test", outDir, "--yes"],
        projectDir,
        fakeHome
      );
      expect(addMarket.exitCode).toBe(0);

      const install = await runCli(
        ["plugin", "install", "aidd-test", "--tool", "copilot", "--yes"],
        projectDir,
        fakeHome
      );
      expect(install.exitCode).toBe(0);
      expect(install.stdout).toContain("aidd-test");
    } finally {
      await cleanup();
    }
  });

  it("AC #2: re-running with identical inputs produces byte-identical output", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-build-idempotent");
    try {
      const outDir = join(tempDir, "dist");

      const run1 = await runCli(
        ["framework", "build", "--source", FRAMEWORK_PATH, "--target", "copilot", "--out", outDir],
        projectDir,
        fakeHome
      );
      expect(run1.exitCode).toBe(0);

      const snapshot1 = await hashDirectory(outDir);

      const run2 = await runCli(
        ["framework", "build", "--source", FRAMEWORK_PATH, "--target", "copilot", "--out", outDir],
        projectDir,
        fakeHome
      );
      expect(run2.exitCode).toBe(0);

      const snapshot2 = await hashDirectory(outDir);

      expect(snapshot1.size).toBeGreaterThan(0);
      expect(snapshot1.size).toBe(snapshot2.size);
      for (const [path, hash] of snapshot1) {
        expect(snapshot2.get(path)).toBe(hash);
      }
    } finally {
      await cleanup();
    }
  });

  it("AC #10: invalid plugin.json halts the build with non-zero exit", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-build-invalid");
    try {
      const { writeFile, mkdir, cp } = await import("node:fs/promises");
      const sourceDir = join(tempDir, "source");
      await cp(FRAMEWORK_PATH, sourceDir, { recursive: true });

      // Corrupt the plugin manifest (remove required 'name' field)
      const manifestPath = join(sourceDir, "plugins", "aidd-test", ".claude-plugin", "plugin.json");
      await mkdir(join(sourceDir, "plugins", "aidd-test", ".claude-plugin"), { recursive: true });
      await writeFile(manifestPath, JSON.stringify({ version: "1.0.0" }), "utf-8");

      const outDir = join(tempDir, "dist");
      const result = await runCli(
        ["framework", "build", "--source", sourceDir, "--target", "copilot", "--out", outDir],
        projectDir,
        fakeHome
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBeTruthy();
    } finally {
      await cleanup();
    }
  });

  it("AC #5 + #6: agents keep .md extension and @./ / @../ / @CLAUDE_PLUGIN_ROOT references rewritten in skills", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-build-rewrites");
    try {
      const outDir = join(tempDir, "dist");
      const build = await runCli(
        ["framework", "build", "--source", FRAMEWORK_PATH, "--target", "copilot", "--out", outDir],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);

      // AC #6: agent keeps .md extension (no rename to .agent.md)
      const agentPath = join(outDir, "plugins", "aidd-test", "agents", "code-reviewer.md");
      expect(existsSync(agentPath)).toBe(true);
      const agentPathRenamed = join(
        outDir,
        "plugins",
        "aidd-test",
        "agents",
        "code-reviewer.agent.md"
      );
      expect(existsSync(agentPathRenamed)).toBe(false);

      const agentContent = await readFile(agentPath, "utf-8");
      expect(agentContent).toContain("name:");
      expect(agentContent).toContain("description:");

      // AC #5: @./ rewritten to markdown link in skill
      const skillPath = join(outDir, "plugins", "aidd-test", "skills", "hello.md");
      expect(existsSync(skillPath)).toBe(true);
      const skillContent = await readFile(skillPath, "utf-8");
      expect(skillContent).toContain("[SKILL.md](./SKILL.md)");
      // @../ rewrite
      expect(skillContent).toContain("[commit/SKILL.md](../commit/SKILL.md)");
      // @CLAUDE_PLUGIN_ROOT/X rewrite — see fixture hello.md for the reference
      const varRef = "$" + "{CLAUDE_PLUGIN_ROOT}";
      expect(skillContent).not.toContain(`@${varRef}`);
    } finally {
      await cleanup();
    }
  });

  it("AC #7: CLAUDE_PLUGIN_ROOT rewritten to relative path in hooks.json and .mcp.json", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-build-root-rewrite");
    try {
      const outDir = join(tempDir, "dist");
      const build = await runCli(
        ["framework", "build", "--source", FRAMEWORK_PATH, "--target", "copilot", "--out", outDir],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);

      const varRef = "$" + "{CLAUDE_PLUGIN_ROOT}";

      const hooksPath = join(outDir, "plugins", "aidd-test", "hooks", "hooks.json");
      const hooksContent = await readFile(hooksPath, "utf-8");
      expect(hooksContent).not.toContain(varRef);
      expect(hooksContent).toContain("./hooks/check.sh");

      const mcpPath = join(outDir, "plugins", "aidd-test", ".mcp.json");
      const mcpContent = await readFile(mcpPath, "utf-8");
      expect(mcpContent).not.toContain(varRef);
      expect(mcpContent).toContain("./bin/server.js");
    } finally {
      await cleanup();
    }
  });

  it("AC #9: marketplace.json uses Copilot-native shape (metadata.pluginRoot, simple-string source)", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-build-marketplace");
    try {
      const outDir = join(tempDir, "dist");
      const build = await runCli(
        ["framework", "build", "--source", FRAMEWORK_PATH, "--target", "copilot", "--out", outDir],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);

      const marketplacePath = join(outDir, ".github", "plugin", "marketplace.json");
      expect(existsSync(marketplacePath)).toBe(true);
      const raw = await readFile(marketplacePath, "utf-8");
      const parsed = JSON.parse(raw) as {
        metadata: { pluginRoot: string };
        plugins: { name: string; source: string }[];
      };

      expect(parsed.metadata.pluginRoot).toBe("./plugins");
      expect(parsed.plugins[0].source).toBe("aidd-test");
      expect(raw).not.toContain("$schema");
      expect(raw).not.toContain("strict");
      expect(raw).not.toContain("recommended");
    } finally {
      await cleanup();
    }
  });

  // ── Flat mode (AC #1, #2, #4, #9 flat variant) ────────────────────────────

  it("flat AC #1: --flat writes agents, skills, hooks, mcp under canonical paths", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-flat-tree");
    try {
      const projRoot = join(tempDir, "proj");
      await mkdir(projRoot, { recursive: true });

      const build = await runCli(
        [
          "framework",
          "build",
          "--source",
          FRAMEWORK_PATH,
          "--target",
          "copilot",
          "--flat",
          "--out",
          projRoot,
        ],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);
      expect(build.stdout).toContain("Flat-installed");

      expect(
        existsSync(join(projRoot, ".github", "agents", "aidd-test", "code-reviewer.agent.md"))
      ).toBe(true);
      expect(
        existsSync(join(projRoot, ".github", "skills", "aidd-test", "commit", "SKILL.md"))
      ).toBe(true);
      expect(existsSync(join(projRoot, ".github", "hooks", "aidd-test.hooks.json"))).toBe(true);
      expect(existsSync(join(projRoot, ".vscode", "mcp.json"))).toBe(true);
      expect(existsSync(join(projRoot, ".github", "plugin", "marketplace.json"))).toBe(false);

      // AC #5: agent frontmatter restricted to Copilot allowlist (name, description, model, tools, agents, argument-hint)
      const COPILOT_ALLOWED_KEYS = new Set([
        "name",
        "description",
        "model",
        "tools",
        "agents",
        "argument-hint",
      ]);
      const agentContent = await readFile(
        join(projRoot, ".github", "agents", "aidd-test", "code-reviewer.agent.md"),
        "utf-8"
      );
      const fmMatch = agentContent.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const fmKeys = fmMatch[1]
          .split("\n")
          .map((l) => l.split(":")[0].trim())
          .filter(Boolean);
        for (const key of fmKeys) {
          expect(COPILOT_ALLOWED_KEYS.has(key)).toBe(true);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("flat AC #2 + AC #9: re-run with --force is byte-identical; re-run without --force halts", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-flat-idempotent");
    try {
      const projRoot = join(tempDir, "proj");
      await mkdir(projRoot, { recursive: true });

      const run1 = await runCli(
        [
          "framework",
          "build",
          "--source",
          FRAMEWORK_PATH,
          "--target",
          "copilot",
          "--flat",
          "--out",
          projRoot,
        ],
        projectDir,
        fakeHome
      );
      expect(run1.exitCode).toBe(0);

      const snapshot1 = await hashDirectory(projRoot);

      const run2 = await runCli(
        [
          "framework",
          "build",
          "--source",
          FRAMEWORK_PATH,
          "--target",
          "copilot",
          "--flat",
          "--force",
          "--out",
          projRoot,
        ],
        projectDir,
        fakeHome
      );
      expect(run2.exitCode).toBe(0);

      const snapshot2 = await hashDirectory(projRoot);
      expect(snapshot1.size).toBeGreaterThan(0);
      expect(snapshot1.size).toBe(snapshot2.size);
      for (const [path, hash] of snapshot1) {
        expect(snapshot2.get(path)).toBe(hash);
      }

      const run3 = await runCli(
        [
          "framework",
          "build",
          "--source",
          FRAMEWORK_PATH,
          "--target",
          "copilot",
          "--flat",
          "--out",
          projRoot,
        ],
        projectDir,
        fakeHome
      );
      expect(run3.exitCode).not.toBe(0);
      expect(run3.stderr).toMatch(/FlatTargetExistsError|already exists|--force/i);
    } finally {
      await cleanup();
    }
  });

  it("flat AC #4 + AC #7: CLAUDE_PLUGIN_ROOT absent; MCP shape, prefix, user entries preserved", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-flat-rewrite");
    try {
      const projRoot = join(tempDir, "proj");
      await mkdir(projRoot, { recursive: true });

      // AC #7: pre-seed .vscode/mcp.json with a user-owned server to assert preservation
      const vscodePath = join(projRoot, ".vscode");
      await mkdir(vscodePath, { recursive: true });
      const existingMcp = {
        servers: { "my-existing-server": { command: "node", args: ["server.js"] } },
      };
      await import("node:fs/promises").then((fs) =>
        fs.writeFile(join(vscodePath, "mcp.json"), JSON.stringify(existingMcp, null, 2), "utf-8")
      );

      const build = await runCli(
        [
          "framework",
          "build",
          "--source",
          FRAMEWORK_PATH,
          "--target",
          "copilot",
          "--flat",
          "--out",
          projRoot,
        ],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);

      const agentContent = await readFile(
        join(projRoot, ".github", "agents", "aidd-test", "code-reviewer.agent.md"),
        "utf-8"
      );
      const varRef = "$" + "{CLAUDE_PLUGIN_ROOT}";
      expect(agentContent).not.toContain(varRef);

      const hooksContent = await readFile(
        join(projRoot, ".github", "hooks", "aidd-test.hooks.json"),
        "utf-8"
      );
      expect(hooksContent).not.toContain(varRef);

      const mcpRaw = await readFile(join(projRoot, ".vscode", "mcp.json"), "utf-8");
      expect(mcpRaw).not.toContain(varRef);
      expect(mcpRaw).toContain(projRoot);

      // AC #7: top-level key must be "servers"; plugin keys prefixed with "aidd-test-"
      const mcpParsed = JSON.parse(mcpRaw) as { servers: Record<string, unknown> };
      expect(typeof mcpParsed.servers).toBe("object");
      const serverKeys = Object.keys(mcpParsed.servers);
      const pluginKeys = serverKeys.filter((k) => k.startsWith("aidd-test-"));
      expect(pluginKeys.length).toBeGreaterThan(0);

      // AC #7: user-owned server must survive
      expect(mcpParsed.servers["my-existing-server"]).toBeDefined();
    } finally {
      await cleanup();
    }
  });

  it("flat guard: --force without --flat exits non-zero with hint", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-flat-guard-force");
    try {
      const outDir = join(tempDir, "dist");
      const result = await runCli(
        [
          "framework",
          "build",
          "--source",
          FRAMEWORK_PATH,
          "--target",
          "copilot",
          "--force",
          "--out",
          outDir,
        ],
        projectDir,
        fakeHome
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("--force requires --flat");
    } finally {
      await cleanup();
    }
  });
});
