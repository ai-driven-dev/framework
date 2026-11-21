import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { restoreRegularFiles } from "../../../../../src/contexts/installation/application/restore/restore-regular-files.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { InputRequiredError } from "../../../../../src/shared/domain/shared.error.js";
import { buildInstallationDeps } from "../../../../shared/testing/installation-deps.builder.js";
import {
  KeepPrompter,
  OverwritePrompter,
  ScriptedPrompter,
} from "../../../../shared/testing/scripted-prompter.fake.js";

const PROJECT_ROOT = "/test-project";

async function buildDeps() {
  return buildInstallationDeps();
}

describe("restoreRegularFiles", () => {
  it("returns null when no manifest file has drifted", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.md"), "current content");
    const prompter = new OverwritePrompter();

    const result = await restoreRegularFiles(deps.fs, prompter, {
      manifestFiles: [{ relativePath: "a.md", hash: FileHash.of("current content") }],
      distMap: new Map(),
      projectRoot: PROJECT_ROOT,
      force: false,
      interactive: false,
      fileFilter: null,
    });

    expect(result).toBeNull();
  });

  it("restores a file deleted from disk, without prompting, even without force", async () => {
    const deps = await buildDeps();
    const prompter = new OverwritePrompter();
    const distMap = new Map([
      [
        "a.md",
        new InstallationFile({
          relativePath: "a.md",
          content: "framework content",
          hash: FileHash.of("framework content"),
        }),
      ],
    ]);

    const result = await restoreRegularFiles(deps.fs, prompter, {
      manifestFiles: [{ relativePath: "a.md", hash: FileHash.of("original content") }],
      distMap,
      projectRoot: PROJECT_ROOT,
      force: false,
      interactive: false,
      fileFilter: null,
    });

    expect(result).not.toBeNull();
    expect(result?.restored).toEqual(["a.md"]);
    expect(result?.kept).toEqual([]);
    expect(deps.fs.getFile(join(PROJECT_ROOT, "a.md"))).toBe("framework content");
    const updated = result?.updatedFiles.find((f) => f.relativePath === "a.md");
    expect(updated?.hash).toEqual(FileHash.of("framework content"));
  });

  it("throws InputRequiredError for a modified file when force=false and interactive=false, without writing", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.md"), "disk modified content");
    const prompter = new OverwritePrompter();
    const distMap = new Map([
      [
        "a.md",
        new InstallationFile({
          relativePath: "a.md",
          content: "framework content",
          hash: FileHash.of("framework content"),
        }),
      ],
    ]);

    await expect(
      restoreRegularFiles(deps.fs, prompter, {
        manifestFiles: [{ relativePath: "a.md", hash: FileHash.of("original content") }],
        distMap,
        projectRoot: PROJECT_ROOT,
        force: false,
        interactive: false,
        fileFilter: null,
      })
    ).rejects.toThrow(InputRequiredError);

    expect(deps.fs.getFile(join(PROJECT_ROOT, "a.md"))).toBe("disk modified content");
  });

  it("overwrites a modified file when force=true without prompting", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.md"), "disk modified content");
    const prompter = new OverwritePrompter();
    const distMap = new Map([
      [
        "a.md",
        new InstallationFile({
          relativePath: "a.md",
          content: "framework content",
          hash: FileHash.of("framework content"),
        }),
      ],
    ]);

    const result = await restoreRegularFiles(deps.fs, prompter, {
      manifestFiles: [{ relativePath: "a.md", hash: FileHash.of("original content") }],
      distMap,
      projectRoot: PROJECT_ROOT,
      force: true,
      interactive: false,
      fileFilter: null,
    });

    expect(result?.restored).toEqual(["a.md"]);
    expect(deps.fs.getFile(join(PROJECT_ROOT, "a.md"))).toBe("framework content");
  });

  it("keeps a modified file when interactive=true and the prompter chooses keep", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.md"), "disk modified content");
    const prompter = new KeepPrompter();
    const originalHash = FileHash.of("original content");
    const distMap = new Map([
      [
        "a.md",
        new InstallationFile({
          relativePath: "a.md",
          content: "framework content",
          hash: FileHash.of("framework content"),
        }),
      ],
    ]);

    const result = await restoreRegularFiles(deps.fs, prompter, {
      manifestFiles: [{ relativePath: "a.md", hash: originalHash }],
      distMap,
      projectRoot: PROJECT_ROOT,
      force: false,
      interactive: true,
      fileFilter: null,
    });

    expect(result?.kept).toEqual(["a.md"]);
    expect(result?.restored).toEqual([]);
    expect(deps.fs.getFile(join(PROJECT_ROOT, "a.md"))).toBe("disk modified content");
    const updated = result?.updatedFiles.find((f) => f.relativePath === "a.md");
    expect(updated?.hash).toEqual(originalHash);
  });

  it("overwrites a modified file when interactive=true and the prompter chooses overwrite", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.md"), "disk modified content");
    const prompter = new OverwritePrompter();
    const distMap = new Map([
      [
        "a.md",
        new InstallationFile({
          relativePath: "a.md",
          content: "framework content",
          hash: FileHash.of("framework content"),
        }),
      ],
    ]);

    const result = await restoreRegularFiles(deps.fs, prompter, {
      manifestFiles: [{ relativePath: "a.md", hash: FileHash.of("original content") }],
      distMap,
      projectRoot: PROJECT_ROOT,
      force: false,
      interactive: true,
      fileFilter: null,
    });

    expect(result?.restored).toEqual(["a.md"]);
    expect(deps.fs.getFile(join(PROJECT_ROOT, "a.md"))).toBe("framework content");
  });

  it("excludes files that fail the fileFilter predicate from drift collection entirely", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.md"), "disk modified content");
    const prompter = new OverwritePrompter();
    const distMap = new Map([
      [
        "a.md",
        new InstallationFile({
          relativePath: "a.md",
          content: "framework a",
          hash: FileHash.of("framework a"),
        }),
      ],
      [
        "b.md",
        new InstallationFile({
          relativePath: "b.md",
          content: "framework b",
          hash: FileHash.of("framework b"),
        }),
      ],
    ]);

    const result = await restoreRegularFiles(deps.fs, prompter, {
      manifestFiles: [
        { relativePath: "a.md", hash: FileHash.of("original a") },
        { relativePath: "b.md", hash: FileHash.of("original b") },
      ],
      distMap,
      projectRoot: PROJECT_ROOT,
      force: true,
      interactive: false,
      fileFilter: (relativePath) => relativePath === "a.md",
    });

    expect(result?.restored).toEqual(["a.md"]);
    expect(result?.kept).toEqual([]);
    expect(deps.fs.has(join(PROJECT_ROOT, "b.md"))).toBe(false);
  });

  it("partitions multiple drifted files into restored and kept within a single call", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.md"), "disk modified a");
    await deps.fs.writeFile(join(PROJECT_ROOT, "b.md"), "disk modified b");
    const prompter = new ScriptedPrompter([
      ScriptedPrompter.answer.conflict("overwrite"),
      ScriptedPrompter.answer.conflict("keep"),
    ]);

    const distMap = new Map([
      [
        "a.md",
        new InstallationFile({
          relativePath: "a.md",
          content: "framework a",
          hash: FileHash.of("framework a"),
        }),
      ],
      [
        "b.md",
        new InstallationFile({
          relativePath: "b.md",
          content: "framework b",
          hash: FileHash.of("framework b"),
        }),
      ],
    ]);

    const result = await restoreRegularFiles(deps.fs, prompter, {
      manifestFiles: [
        { relativePath: "a.md", hash: FileHash.of("original a") },
        { relativePath: "b.md", hash: FileHash.of("original b") },
      ],
      distMap,
      projectRoot: PROJECT_ROOT,
      force: false,
      interactive: true,
      fileFilter: null,
    });

    expect(result?.restored).toEqual(["a.md"]);
    expect(result?.kept).toEqual(["b.md"]);
    expect(deps.fs.getFile(join(PROJECT_ROOT, "a.md"))).toBe("framework a");
    expect(deps.fs.getFile(join(PROJECT_ROOT, "b.md"))).toBe("disk modified b");
  });

  it("reports a deleted file with no corresponding dist entry as unrestorable, without touching disk", async () => {
    const deps = await buildDeps();
    const prompter = new OverwritePrompter();

    const result = await restoreRegularFiles(deps.fs, prompter, {
      manifestFiles: [{ relativePath: "a.md", hash: FileHash.of("original content") }],
      distMap: new Map(),
      projectRoot: PROJECT_ROOT,
      force: true,
      interactive: false,
      fileFilter: null,
    });

    expect(result?.unrestorable).toEqual(["a.md"]);
    expect(result?.restored).toEqual([]);
    expect(result?.kept).toEqual([]);
    expect(deps.fs.has(join(PROJECT_ROOT, "a.md"))).toBe(false);
  });

  it("reports a modified file with no corresponding dist entry as unrestorable, without touching disk", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.md"), "disk modified content");
    const prompter = new OverwritePrompter();

    const result = await restoreRegularFiles(deps.fs, prompter, {
      manifestFiles: [{ relativePath: "a.md", hash: FileHash.of("original content") }],
      distMap: new Map(),
      projectRoot: PROJECT_ROOT,
      force: true,
      interactive: false,
      fileFilter: null,
    });

    expect(result?.unrestorable).toEqual(["a.md"]);
    expect(result?.restored).toEqual([]);
    expect(result?.kept).toEqual([]);
    expect(deps.fs.getFile(join(PROJECT_ROOT, "a.md"))).toBe("disk modified content");
  });
});

describe("restoreRegularFiles — the files it hands back", () => {
  it("hands back a restored file under its new hash and with no content", async () => {
    const deps = await buildDeps();
    const prompter = new OverwritePrompter();
    const distMap = new Map([
      [
        "a.md",
        new InstallationFile({
          relativePath: "a.md",
          content: "framework content",
          hash: FileHash.of("framework content"),
        }),
      ],
    ]);

    const result = await restoreRegularFiles(deps.fs, prompter, {
      manifestFiles: [{ relativePath: "a.md", hash: FileHash.of("original content") }],
      distMap,
      projectRoot: PROJECT_ROOT,
      force: true,
      interactive: false,
      fileFilter: null,
    });

    expect(result?.updatedFiles).toStrictEqual([
      new InstallationFile({
        relativePath: "a.md",
        content: "",
        hash: FileHash.of("framework content"),
      }),
    ]);
  });
});
