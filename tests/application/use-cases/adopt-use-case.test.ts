import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdoptUseCase } from "../../../src/application/use-cases/adopt-use-case.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "./helpers.js";

describe("AdoptUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  function buildUseCase() {
    const deps = buildDeps(projectRoot);
    return new AdoptUseCase(deps.fs, deps.manifestRepo, deps.logger);
  }

  const DEFAULT_OPTS = { docsDir: "aidd_docs", version: "3.3.3" };

  it("throws on unknown tool id", async () => {
    await expect(
      buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: ["unknown" as never], projectRoot })
    ).rejects.toThrow("Unknown tool");
  });

  it("throws when toolIds is empty", async () => {
    await expect(
      buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: [], projectRoot })
    ).rejects.toThrow("No tools specified");
  });

  it("aborts if manifest already exists", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    await expect(
      buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: ["claude"], projectRoot })
    ).rejects.toThrow("Already initialized");
  });

  it("throws if specified tool directory does not exist", async () => {
    await expect(
      buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: ["claude"], projectRoot })
    ).rejects.toThrow("Directory '.claude/' not found for tool 'claude'");
  });

  it("registers all files on disk without modifying them", async () => {
    await mkdir(join(projectRoot, ".claude", "rules", "01-standards"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "rules", "01-standards", "naming.md"), "# Naming");
    await writeFile(join(projectRoot, ".claude", "rules", "01-standards", "style.md"), "# Style");

    const result = await buildUseCase().execute({
      ...DEFAULT_OPTS,
      toolIds: ["claude"],
      projectRoot,
    });

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].toolId).toBe("claude");
    expect(result.totalRegistered).toBe(2);
    expect(result.tools[0].registered).toContain(".claude/rules/01-standards/naming.md");
    expect(result.tools[0].registered).toContain(".claude/rules/01-standards/style.md");
    expect(
      await readFile(join(projectRoot, ".claude", "rules", "01-standards", "naming.md"), "utf-8")
    ).toBe("# Naming");
  });

  it("stores the exact disk hash in the manifest", async () => {
    const fileContent = "some content";
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "CLAUDE.md"), fileContent);

    await buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: ["claude"], projectRoot });

    const data = JSON.parse(
      await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8")
    ) as {
      tools: Record<string, { files: Array<{ relativePath: string; hash: string }> }>;
    };
    const entry = data.tools.claude.files.find((f) => f.relativePath === ".claude/CLAUDE.md");
    expect(entry).toBeDefined();
    expect(entry!.hash).toBe(createHash("md5").update(fileContent).digest("hex"));
  });

  it("stores the provided version in the manifest", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "CLAUDE.md"), "content");

    await buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: ["claude"], projectRoot });

    const data = JSON.parse(
      await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8")
    ) as {
      tools: Record<string, { version: string }>;
    };
    expect(data.tools.claude.version).toBe("3.3.3");
  });

  it("deletes legacy config.json if present", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "CLAUDE.md"), "content");
    await mkdir(join(projectRoot, ".aidd"), { recursive: true });
    await writeFile(join(projectRoot, ".aidd", "config.json"), "{}");

    await buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: ["claude"], projectRoot });

    expect(existsSync(join(projectRoot, ".aidd", "config.json"))).toBe(false);
  });

  it("registers docs directory when present", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "CLAUDE.md"), "content");
    await mkdir(join(projectRoot, "aidd_docs", "memory"), { recursive: true });
    await writeFile(join(projectRoot, "aidd_docs", "README.md"), "# Docs");
    await writeFile(join(projectRoot, "aidd_docs", "memory", "notes.md"), "notes");

    const result = await buildUseCase().execute({
      ...DEFAULT_OPTS,
      toolIds: ["claude"],
      projectRoot,
    });

    expect(result.docsRegistered).toBe(2);
  });

  it("registers docs dir as empty when present but contains no files", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "CLAUDE.md"), "content");
    await mkdir(join(projectRoot, "aidd_docs"), { recursive: true });

    const result = await buildUseCase().execute({
      ...DEFAULT_OPTS,
      toolIds: ["claude"],
      projectRoot,
    });

    expect(result.docsRegistered).toBe(0);
  });

  it("registers multiple tools independently", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "CLAUDE.md"), "content");
    await mkdir(join(projectRoot, ".github"), { recursive: true });
    await writeFile(join(projectRoot, ".github", "copilot-instructions.md"), "# Copilot");

    const result = await buildUseCase().execute({
      ...DEFAULT_OPTS,
      toolIds: ["claude", "copilot"],
      projectRoot,
    });

    expect(result.tools.map((t) => t.toolId)).toEqual(["claude", "copilot"]);
    expect(result.tools.find((t) => t.toolId === "claude")!.registered).toHaveLength(1);
    expect(result.tools.find((t) => t.toolId === "copilot")!.registered).toHaveLength(1);
  });

  it("registers user custom files alongside framework files", async () => {
    await mkdir(join(projectRoot, ".claude", "rules"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "rules", "framework.md"), "# Framework");
    await writeFile(join(projectRoot, ".claude", "rules", "my-custom.md"), "# Custom");

    const result = await buildUseCase().execute({
      ...DEFAULT_OPTS,
      toolIds: ["claude"],
      projectRoot,
    });

    expect(result.tools[0].registered).toHaveLength(2);
    expect(result.tools[0].registered).toContain(".claude/rules/my-custom.md");
    expect(result.tools[0].registered).toContain(".claude/rules/framework.md");
  });

  it("creates CATALOG.md after adoption", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "CLAUDE.md"), "content");

    await buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: ["claude"], projectRoot });

    expect(existsSync(join(projectRoot, "aidd_docs", "CATALOG.md"))).toBe(true);
  });
});
