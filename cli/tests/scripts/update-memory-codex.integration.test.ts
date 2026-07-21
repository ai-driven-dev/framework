import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), ".aidd", "scripts", "update_memory.cjs");

describe("update_memory.cjs with Codex installed", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "aidd-update-memory-codex-"));
    await mkdir(join(tmpDir, ".aidd", "scripts"), { recursive: true });
    await mkdir(join(tmpDir, "aidd_docs", "memory"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeManifest(withCodex: boolean): Promise<void> {
    const manifest = withCodex
      ? { docsDir: "aidd_docs", tools: { codex: { toolId: "codex", version: "1.0.0", files: [] } } }
      : { docsDir: "aidd_docs", tools: {} };
    await writeFile(join(tmpDir, ".aidd", "manifest.json"), JSON.stringify(manifest));
  }

  async function writeMemoryFile(name: string, content: string): Promise<void> {
    await writeFile(join(tmpDir, "aidd_docs", "memory", name), content, "utf8");
  }

  async function writeAgentsMd(content: string): Promise<void> {
    await writeFile(join(tmpDir, "AGENTS.md"), content, "utf8");
  }

  function runScript(): void {
    execSync(`node "${SCRIPT_PATH}"`, {
      cwd: tmpDir,
      stdio: ["pipe", "pipe", "pipe"],
    });
  }

  it("writes Codex inline memory block when Codex is installed", async () => {
    await writeManifest(true);
    await writeMemoryFile("architecture.md", "## Architecture\nDetails here.");
    await writeAgentsMd(
      "<aidd_project_memory></aidd_project_memory>\n<!-- aidd:memory:codex:start --><!-- aidd:memory:codex:end -->\n"
    );

    runScript();

    const result = readFileSync(join(tmpDir, "AGENTS.md"), "utf8");
    expect(result).toContain("## Architecture");
    expect(result).toContain("Details here.");
    expect(result).toContain("<!-- aidd:memory:codex:start -->");
    expect(result).toContain("<!-- aidd:memory:codex:end -->");
  });

  it("appends Codex block markers when absent in AGENTS.md", async () => {
    await writeManifest(true);
    await writeMemoryFile("note.md", "Note content.");
    await writeAgentsMd("<aidd_project_memory></aidd_project_memory>\n");

    runScript();

    const result = readFileSync(join(tmpDir, "AGENTS.md"), "utf8");
    expect(result).toContain("<!-- aidd:memory:codex:start -->");
    expect(result).toContain("<!-- aidd:memory:codex:end -->");
    expect(result).toContain("Note content.");
  });

  it("does not write Codex inline block when Codex is not installed", async () => {
    await writeManifest(false);
    await writeMemoryFile("architecture.md", "## Architecture");
    await writeAgentsMd("<aidd_project_memory></aidd_project_memory>\n");

    runScript();

    const result = readFileSync(join(tmpDir, "AGENTS.md"), "utf8");
    expect(result).not.toContain("<!-- aidd:memory:codex:start -->");
  });
});
