import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdoptUseCase } from "../../../src/application/use-cases/adopt/adopt-use-case.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "./helpers.js";

describe("adopt", () => {
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
    return new AdoptUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.assetProvider);
  }

  const DEFAULT_OPTS = {
    docsDir: "aidd_docs",
    version: "3.3.3",
  };

  it("fails with unknown tool error when tool id is not recognized", async () => {
    await expect(
      buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: ["unknown" as never], projectRoot })
    ).rejects.toThrow("Unknown tool");
  });

  it("fails when no tools are specified", async () => {
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

  it("skips a tool with a warning when its directory does not exist on disk", async () => {
    const result = await buildUseCase().execute({
      ...DEFAULT_OPTS,
      toolIds: ["claude"],
      projectRoot,
    });

    expect(result.tools).toHaveLength(0);
    expect(result.totalRegistered).toBe(0);
  });

  it("registers all files found in the tool directory", async () => {
    await mkdir(join(projectRoot, ".claude", "rules", "01-standards"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "rules", "01-standards", "naming.md"), "# Naming");
    await writeFile(join(projectRoot, ".claude", "rules", "01-standards", "style.md"), "# Style");

    const result = await buildUseCase().execute({
      ...DEFAULT_OPTS,
      toolIds: ["claude"],
      projectRoot,
    });

    expect(result.tools[0].registered).toContain(".claude/rules/01-standards/naming.md");
    expect(result.tools[0].registered).toContain(".claude/rules/01-standards/style.md");
    // files on disk are not modified
    expect(
      await readFile(join(projectRoot, ".claude", "rules", "01-standards", "naming.md"), "utf-8")
    ).toBe("# Naming");
  });

  it("stores the exact disk hash in the manifest", async () => {
    const fileContent = "some content";
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, "CLAUDE.md"), fileContent);

    await buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: ["claude"], projectRoot });

    const data = JSON.parse(
      await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8")
    ) as {
      tools: Record<string, { files: Array<{ relativePath: string; hash: string }> }>;
    };
    const entry = data.tools.claude.files.find((f) => f.relativePath === "CLAUDE.md");
    expect(entry).toBeDefined();
    expect(entry?.hash).toBe(createHash("md5").update(fileContent).digest("hex"));
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

  it("regenerates the catalog after adopt", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "CLAUDE.md"), "content");

    await buildUseCase().execute({
      ...DEFAULT_OPTS,
      toolIds: ["claude"],
      projectRoot,
    });

    const catalogPath = join(projectRoot, "aidd_docs", "CATALOG.md");
    expect(existsSync(catalogPath)).toBe(true);
  });

  it("registers multiple tools independently", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, "CLAUDE.md"), "content");
    await mkdir(join(projectRoot, ".github"), { recursive: true });
    await writeFile(join(projectRoot, ".github", "copilot-instructions.md"), "# Copilot");

    const result = await buildUseCase().execute({
      ...DEFAULT_OPTS,
      toolIds: ["claude", "copilot"],
      projectRoot,
    });

    expect(result.tools.map((t) => t.toolId)).toEqual(["claude", "copilot"]);
    expect(result.tools.find((t) => t.toolId === "claude")?.registered).toContain("CLAUDE.md");
    expect(result.tools.find((t) => t.toolId === "copilot")?.registered).toContain(
      ".github/copilot-instructions.md"
    );
  });

  it("registers user-added files alongside aidd-managed ones", async () => {
    await mkdir(join(projectRoot, ".claude", "rules", "01-standards"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "rules", "01-standards", "naming.md"), "# Naming");
    await writeFile(join(projectRoot, ".claude", "rules", "my-custom.md"), "# Custom");

    const result = await buildUseCase().execute({
      ...DEFAULT_OPTS,
      toolIds: ["claude"],
      projectRoot,
    });

    expect(result.tools[0].registered).toContain(".claude/rules/01-standards/naming.md");
    expect(result.tools[0].registered).toContain(".claude/rules/my-custom.md");
  });

  it("creates CATALOG.md after adoption", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, ".claude", "CLAUDE.md"), "content");

    await buildUseCase().execute({ ...DEFAULT_OPTS, toolIds: ["claude"], projectRoot });

    expect(existsSync(join(projectRoot, "aidd_docs", "CATALOG.md"))).toBe(true);
  });
});
