import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DoctorUseCase,
  extractAtReferences,
  extractMarkdownLinkTargets,
} from "../../../src/application/use-cases/doctor-use-case.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "./helpers.js";

describe("extractAtReferences", () => {
  it("extracts @path references with at least one slash", () => {
    expect(extractAtReferences("See @.claude/agents/iris.md for details")).toEqual([
      ".claude/agents/iris.md",
    ]);
  });

  it("deduplicates identical references", () => {
    const refs = extractAtReferences("@foo/bar.md and @foo/bar.md again");
    expect(refs).toHaveLength(1);
  });

  it("ignores @word with no slash (single-segment)", () => {
    expect(extractAtReferences("@username has no slash")).toEqual([]);
  });

  it("extracts @path references inside plain fenced code blocks (no language)", () => {
    expect(extractAtReferences("```\n@.claude/agents/missing.md\n```")).toEqual([
      ".claude/agents/missing.md",
    ]);
  });

  it("extracts @path references inside ```markdown fenced code blocks", () => {
    expect(extractAtReferences("```markdown\n@aidd_docs/templates/aidd/agent.md\n```")).toEqual([
      "aidd_docs/templates/aidd/agent.md",
    ]);
  });

  it("skips @path references inside non-markdown fenced code blocks (e.g. ```text)", () => {
    expect(extractAtReferences("```text\n@path/to/file.md\n```")).toEqual([]);
  });

  it("skips references inside inline code", () => {
    expect(extractAtReferences("`@.claude/rules/test.md`")).toEqual([]);
  });
});

describe("extractMarkdownLinkTargets", () => {
  it("extracts relative markdown link targets", () => {
    expect(extractMarkdownLinkTargets("[doc](aidd_docs/memory/architecture.md)")).toEqual([
      "aidd_docs/memory/architecture.md",
    ]);
  });

  it("ignores http/https links", () => {
    expect(extractMarkdownLinkTargets("[site](https://example.com)")).toEqual([]);
  });

  it("deduplicates identical targets", () => {
    const refs = extractMarkdownLinkTargets("[a](foo/bar.md) [b](foo/bar.md)");
    expect(refs).toHaveLength(1);
  });

  it("extracts targets inside plain fenced code blocks (no language)", () => {
    expect(extractMarkdownLinkTargets("```\n[doc](foo/bar.md)\n```")).toEqual(["foo/bar.md"]);
  });

  it("extracts targets inside ```markdown fenced code blocks", () => {
    expect(extractMarkdownLinkTargets("```markdown\n[doc](aidd_docs/memory/arch.md)\n```")).toEqual(
      ["aidd_docs/memory/arch.md"]
    );
  });

  it("skips targets inside non-markdown fenced code blocks (e.g. ```text)", () => {
    expect(extractMarkdownLinkTargets("```text\n[doc](foo/bar.md)\n```")).toEqual([]);
  });
});

describe("DoctorUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("reports healthy when all files are in sync", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.healthy).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("fails when manifest is corrupted", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude" as ToolId);

    // Write invalid JSON to manifest
    await writeFile(join(projectRoot, ".aidd", "manifest.json"), "{ invalid json }", "utf-8");

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);

    await expect(useCase.execute({ projectRoot })).rejects.toThrow("Manifest is corrupted");
  });

  it("fails if project is not initialized", async () => {
    const deps = buildDeps(projectRoot);

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);

    await expect(useCase.execute({ projectRoot })).rejects.toThrow("No AIDD installation found");
  });

  it("warns about tool directory not registered in manifest", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude" as ToolId);

    // Create an orphaned .cursor directory (cursor is not installed)
    await mkdir(join(projectRoot, ".cursor"), { recursive: true });
    await writeFile(join(projectRoot, ".cursor", "some-file.md"), "orphaned", "utf-8");

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    const orphanIssue = report.issues.find(
      (i) => i.message.includes(".cursor/") && i.message.includes("Orphaned")
    );
    expect(orphanIssue).toBeDefined();
  });

  it("reports warning for broken @path reference in a tracked file", async () => {
    const deps = buildDeps(projectRoot);
    const installResult = await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const firstFile = installResult.files[0];
    await writeFile(
      join(projectRoot, firstFile.relativePath),
      "See @.claude/agents/missing-agent.md for details",
      "utf-8"
    );

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    const refIssue = report.issues.find((i) => i.message.includes("missing-agent.md"));
    expect(refIssue).toBeDefined();
    expect(refIssue?.severity).toBe("warning");
  });

  it("does not report broken reference for directory-only @path (trailing slash, no extension)", async () => {
    const deps = buildDeps(projectRoot);
    const installResult = await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const firstFile = installResult.files[0];
    await writeFile(
      join(projectRoot, firstFile.relativePath),
      "See @.claude/agents/ for all agents",
      "utf-8"
    );

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.issues.every((i) => !i.message.includes(".claude/agents/"))).toBe(true);
  });

  it("reports broken markdown link target for copilot tracked files", async () => {
    const deps = buildDeps(projectRoot);
    const installResult = await initAndInstall(deps, projectRoot, "copilot" as ToolId);

    const firstFile = installResult.files.find((f) => f.relativePath.endsWith(".md"));
    if (!firstFile) return; // guard: copilot installs .md files

    await writeFile(
      join(projectRoot, firstFile.relativePath),
      "[See this doc](aidd_docs/memory/non-existent.md)",
      "utf-8"
    );

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    const linkIssue = report.issues.find((i) => i.message.includes("non-existent.md"));
    expect(linkIssue).toBeDefined();
    expect(linkIssue?.severity).toBe("warning");
  });

  it("reports broken @path reference inside plain fenced code block", async () => {
    const deps = buildDeps(projectRoot);
    const installResult = await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const firstFile = installResult.files[0];
    await writeFile(
      join(projectRoot, firstFile.relativePath),
      "```\n@.claude/agents/missing-agent.md\n```",
      "utf-8"
    );

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    const refIssue = report.issues.find((i) => i.message.includes("missing-agent.md"));
    expect(refIssue).toBeDefined();
  });

  it("reports broken @path reference inside ```markdown fenced code block", async () => {
    const deps = buildDeps(projectRoot);
    const installResult = await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const firstFile = installResult.files[0];
    await writeFile(
      join(projectRoot, firstFile.relativePath),
      "```markdown\n@aidd_docs/templates/aidd/agent.md\n```",
      "utf-8"
    );

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    const refIssue = report.issues.find((i) => i.message.includes("agent.md"));
    expect(refIssue).toBeDefined();
  });

  it("reports broken markdown link inside ```markdown block for copilot files", async () => {
    const deps = buildDeps(projectRoot);
    const installResult = await initAndInstall(deps, projectRoot, "copilot" as ToolId);

    const firstFile = installResult.files.find((f) => f.relativePath.endsWith(".md"));
    if (!firstFile) return;

    await writeFile(
      join(projectRoot, firstFile.relativePath),
      "```markdown\n[doc](aidd_docs/memory/non-existent.md)\n```",
      "utf-8"
    );

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    const linkIssue = report.issues.find((i) => i.message.includes("non-existent.md"));
    expect(linkIssue).toBeDefined();
  });

  it("does not report broken @path reference inside non-markdown fenced code block", async () => {
    const deps = buildDeps(projectRoot);
    const installResult = await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const firstFile = installResult.files[0];
    await writeFile(
      join(projectRoot, firstFile.relativePath),
      "```text\n@path/to/example.md\n```",
      "utf-8"
    );

    const useCase = new DoctorUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.issues.every((i) => !i.message.includes("example.md"))).toBe(true);
  });
});
