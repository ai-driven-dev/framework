import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLI_PATH,
  createTestEnv,
  execFileAsync,
  FRAMEWORK_PATH,
  initProject,
  runCli,
} from "./helpers.js";

async function runCliNoAuth(
  args: string[],
  cwd: string,
  fakeHome: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: fakeHome };
  delete env.AIDD_TOKEN;
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, ...args], { cwd, env });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code ?? 1,
    };
  }
}

describe.concurrent("E2E: aidd install", () => {
  it("requires init first — aborts with clear error on uninitialized project", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      const { stderr, exitCode } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD manifest found");
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("installs claude tool with correct file layout", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
      expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("installs cursor tool with correct file layout", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "ai", "cursor", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed cursor");
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("installs copilot tool with correct file layout", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "ai", "copilot", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed copilot");
      expect(existsSync(join(projectDir, ".github"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("shows an error message for unrecognized tool IDs", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stderr, exitCode } = await runCli(
        ["install", "ai", "unknown-tool", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown tool");
    } finally {
      await cleanup();
    }
  });

  it("skips already installed tool without --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stderr).toContain("already installed");
    } finally {
      await cleanup();
    }
  });

  it("reinstalls an existing tool when --force is used", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["install", "ai", "claude", "--force", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
    } finally {
      await cleanup();
    }
  });

  it("installs all tools at once with --all", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "--all", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(stdout).toContain("cursor");
      expect(stdout).toContain("copilot");
      expect(stdout).toContain("opencode");
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
      expect(existsSync(join(projectDir, ".github"))).toBe(true);
      expect(existsSync(join(projectDir, ".opencode"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("exits with error in non-interactive mode when no tool is specified and --all is not used", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      const { stderr, exitCode } = await runCli(["install", "--path", FRAMEWORK_PATH], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("non-interactive mode");
    } finally {
      await cleanup();
    }
  });

  it("shows no drift in status after installing all tools at once", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "--all", "--path", FRAMEWORK_PATH], projectDir);
      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).not.toContain("modified");
      expect(stdout).not.toContain("deleted");
    } finally {
      await cleanup();
    }
  });

  it("reinstalls all tools when --all --force is used", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "--all", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["install", "--all", "--force", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(stdout).toContain("cursor");
      expect(stdout).toContain("copilot");
      expect(stdout).toContain("opencode");
    } finally {
      await cleanup();
    }
  });

  it("uses aidd_docs as the docs directory when installing", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      expect(existsSync(join(projectDir, "aidd_docs"))).toBe(true);

      const { exitCode: installExit } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );
      expect(installExit).toBe(0);

      // aidd_docs must still exist after install
      expect(existsSync(join(projectDir, "aidd_docs"))).toBe(true);

      // manifest does not store docsDir anymore (hardcoded constant)
      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
      expect("docsDir" in manifest).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("generates files with all path placeholders resolved", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as {
        tools: { claude: { files: { relativePath: string }[] } };
      };

      for (const file of manifest.tools.claude.files) {
        const content = await readFile(join(projectDir, file.relativePath), "utf-8");
        expect(content).not.toContain("{{TOOLS}}/");
        expect(content).not.toContain("{{DOCS}}/");
      }
    } finally {
      await cleanup();
    }
  });

  it("installs opencode tool with correct file layout", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "ai", "opencode", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed opencode");
      expect(existsSync(join(projectDir, ".opencode"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("warns and ignores explicit tool IDs when --all is set", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(
        ["install", "--all", "ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stderr).toContain("ignoring specified tools");
    } finally {
      await cleanup();
    }
  });

  it("preserves pre-existing user file in rules section", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const userFilePath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "rules",
        "01-standards",
        "naming.md"
      );
      await mkdir(join(projectDir, ".claude", "plugins", "aidd-test", "rules", "01-standards"), {
        recursive: true,
      });
      await writeFile(userFilePath, "user naming rule");

      const { stderr, exitCode } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      const content = await readFile(userFilePath, "utf-8");
      expect(content).toBe("user naming rule");
      expect(stderr).toContain("naming.md");
    } finally {
      await cleanup();
    }
  });

  it("preserves pre-existing user file in commands section", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const userFilePath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "commands",
        "04",
        "implement.md"
      );
      await mkdir(join(projectDir, ".claude", "plugins", "aidd-test", "commands", "04"), {
        recursive: true,
      });
      await writeFile(userFilePath, "user implement command");

      const { stderr, exitCode } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      const content = await readFile(userFilePath, "utf-8");
      expect(content).toBe("user implement command");
      expect(stderr).toContain("implement.md");
    } finally {
      await cleanup();
    }
  });

  it("preserves pre-existing user file in agents section", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const userFilePath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "agents",
        "code-reviewer.md"
      );
      await mkdir(join(projectDir, ".claude", "plugins", "aidd-test", "agents"), {
        recursive: true,
      });
      await writeFile(userFilePath, "user agent");

      const { stderr, exitCode } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      const content = await readFile(userFilePath, "utf-8");
      expect(content).toBe("user agent");
      expect(stderr).toContain("code-reviewer.md");
    } finally {
      await cleanup();
    }
  });

  it("preserves pre-existing user file in skills section", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const userFilePath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "skills",
        "commit",
        "SKILL.md"
      );
      await mkdir(join(projectDir, ".claude", "plugins", "aidd-test", "skills", "commit"), {
        recursive: true,
      });
      await writeFile(userFilePath, "user skill");

      const { stderr, exitCode } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      const content = await readFile(userFilePath, "utf-8");
      expect(content).toBe("user skill");
      expect(stderr).toContain("SKILL.md");
    } finally {
      await cleanup();
    }
  });

  it("writes opencode config to opencode.jsonc when that file already exists before install", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const jsoncPath = join(projectDir, "opencode.jsonc");
      await writeFile(jsoncPath, "{}");

      const { exitCode } = await runCli(
        ["install", "ai", "opencode", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(existsSync(jsoncPath)).toBe(true);
      expect(existsSync(join(projectDir, "opencode.json"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("exits with error when both opencode.json and opencode.jsonc exist before install", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await writeFile(join(projectDir, "opencode.json"), "{}");
      await writeFile(join(projectDir, "opencode.jsonc"), "{}");

      const { stderr, exitCode } = await runCli(
        ["install", "ai", "opencode", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("opencode.json");
      expect(stderr).toContain("opencode.jsonc");
    } finally {
      await cleanup();
    }
  });

  it("--path local framework with explicit tool uses specified local path", async () => {
    const { projectDir, cleanup } = await createTestEnv("install-path");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stdout, exitCode } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("--mcp filter with claude installs only specified MCP servers", async () => {
    const { projectDir, cleanup } = await createTestEnv("install-mcp");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stdout, exitCode } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH, "--mcp", "playwright"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");

      const mcpRaw = await readFile(join(projectDir, ".mcp.json"), "utf-8");
      const mcp = JSON.parse(mcpRaw) as { mcpServers: Record<string, unknown> };
      expect(mcp.mcpServers).toHaveProperty("playwright");
      expect(mcp.mcpServers).not.toHaveProperty("github");
    } finally {
      await cleanup();
    }
  });

  it("--mcp filter with tool that has no MCP config exits successfully", async () => {
    const { projectDir, cleanup } = await createTestEnv("install-mcp-no-mcp");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { exitCode } = await runCli(
        ["install", "ai", "cursor", "--path", FRAMEWORK_PATH, "--mcp", "playwright"],
        projectDir
      );

      expect(exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it("install ai --all installs all AI category tools", async () => {
    const { projectDir, cleanup } = await createTestEnv("install-ai-all");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stdout, exitCode } = await runCli(
        ["install", "ai", "--all", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(stdout).toContain("cursor");
      expect(stdout).toContain("copilot");
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("install ai with no tool specified in non-TTY exits with error", async () => {
    const { projectDir, cleanup } = await createTestEnv("install-ai-no-tool");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(
        ["install", "ai", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("required");
    } finally {
      await cleanup();
    }
  });

  it("installs codex tool with correct file layout", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "ai", "codex", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed codex");
      expect(existsSync(join(projectDir, ".codex"))).toBe(true);
      expect(
        existsSync(
          join(projectDir, ".codex", "plugins", "aidd-test", "skills", "commit", "SKILL.md")
        )
      ).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("installs vscode tool with correct file layout", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "ide", "vscode", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed vscode");
      expect(existsSync(join(projectDir, ".vscode", "extensions.json"))).toBe(true);
      expect(existsSync(join(projectDir, ".vscode", "keybindings.json"))).toBe(true);
      expect(existsSync(join(projectDir, ".vscode", "settings.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("cursor rules have .mdc extension after install", async () => {
    const { projectDir, cleanup } = await createTestEnv("install-cursor-mdc");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { exitCode } = await runCli(
        ["install", "ai", "cursor", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(
        existsSync(join(projectDir, ".cursor/plugins/aidd-test/rules/01-standards/naming.mdc"))
      ).toBe(true);
      expect(
        existsSync(join(projectDir, ".cursor/plugins/aidd-test/rules/01-standards/naming.md"))
      ).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("copilot rules have .instructions.md extension and flattened filenames after install", async () => {
    const { projectDir, cleanup } = await createTestEnv("install-copilot-instructions");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { exitCode } = await runCli(
        ["install", "ai", "copilot", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(
        existsSync(
          join(projectDir, ".github/plugins/aidd-test/instructions/01-naming.instructions.md")
        )
      ).toBe(true);
      expect(existsSync(join(projectDir, ".github/plugins/aidd-test/instructions/naming.md"))).toBe(
        false
      );
    } finally {
      await cleanup();
    }
  });

  it("cursor MCP file is named mcp.json (no leading dot) after install", async () => {
    const { projectDir, cleanup } = await createTestEnv("install-cursor-mcp");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { exitCode } = await runCli(
        ["install", "ai", "cursor", "--path", FRAMEWORK_PATH, "--no-plugins"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(existsSync(join(projectDir, ".cursor/mcp.json"))).toBe(true);
      expect(existsSync(join(projectDir, ".cursor/.mcp.json"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("claude MCP file is named .mcp.json at project root after install", async () => {
    const { projectDir, cleanup } = await createTestEnv("install-claude-mcp");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { exitCode } = await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH, "--no-plugins"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(existsSync(join(projectDir, ".mcp.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("--release flag without --path triggers remote resolution and requires auth", async () => {
    const { projectDir, cleanup } = await createTestEnv("install-release");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const fakeHome = join(projectDir, "fake-home");
      await mkdir(fakeHome, { recursive: true });

      const { stderr, exitCode } = await runCliNoAuth(
        ["install", "ai", "claude", "--release", "v3.9.0"],
        projectDir,
        fakeHome
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/not authenticated|auth login/i);
    } finally {
      await cleanup();
    }
  });
});
