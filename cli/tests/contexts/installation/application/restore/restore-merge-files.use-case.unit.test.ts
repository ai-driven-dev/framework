import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RestoreDriftEntries } from "../../../../../src/contexts/installation/application/restore/restore-drift-entries.use-case.js";
import { RestoreMergeFiles } from "../../../../../src/contexts/installation/application/restore/restore-merge-files.use-case.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import type { MergeFileEntry } from "../../../../../src/shared/domain/merge.js";
import { InputRequiredError } from "../../../../../src/shared/domain/shared.error.js";
import { buildInstallationDeps } from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools } from "../../../../shared/testing/registered-tools.builder.js";
import {
  KeepPrompter,
  OverwritePrompter,
  ScriptedPrompter,
} from "../../../../shared/testing/scripted-prompter.fake.js";

const PROJECT_ROOT = "/test-project";

async function buildDeps() {
  return buildInstallationDeps({ tools: registeredTools() });
}

describe("restoring the merge files", () => {
  it("returns null when no merge file has drifted", async () => {
    const deps = await buildDeps();
    const settingsPath = join(PROJECT_ROOT, "settings.json");
    await deps.fs.writeFile(settingsPath, JSON.stringify({ a: "1" }));
    const prompter = new OverwritePrompter();

    const result = await new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
      mergeFiles: [
        {
          relativePath: "settings.json",
          sectionKey: null,
          entries: { a: FileHash.of(JSON.stringify("1")) },
        },
      ],
      distMap: new Map([
        [
          "settings.json",
          new InstallationFile({
            relativePath: "settings.json",
            content: JSON.stringify({ a: "1" }),
            hash: FileHash.of(JSON.stringify({ a: "1" })),
            mergeStrategy: "framework-prime",
          }),
        ],
      ]),
      projectRoot: PROJECT_ROOT,
      force: false,
      interactive: false,
      fileFilter: null,
    });

    expect(result).toBeNull();
  });

  it("refuses a merge file that cannot be parsed, naming it, and leaves it untouched", async () => {
    const deps = await buildDeps();
    const settingsPath = join(PROJECT_ROOT, "settings.json");
    await deps.fs.writeFile(settingsPath, "{ not json");
    const distContent = JSON.stringify({ a: "framework-a" });

    await expect(
      new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(new OverwritePrompter())).execute({
        mergeFiles: [
          {
            relativePath: "settings.json",
            sectionKey: null,
            entries: { a: FileHash.of(JSON.stringify("framework-a")) },
          },
        ],
        distMap: new Map([
          [
            "settings.json",
            new InstallationFile({
              relativePath: "settings.json",
              content: distContent,
              hash: FileHash.of(distContent),
              mergeStrategy: "framework-prime",
            }),
          ],
        ]),
        projectRoot: PROJECT_ROOT,
        force: true,
        interactive: false,
        fileFilter: null,
      })
    ).rejects.toMatchObject({ code: "json-parse", path: settingsPath });
    expect(await deps.fs.readFile(settingsPath)).toBe("{ not json");
  });

  it("recreates a merge file deleted from disk, without prompting, even without force", async () => {
    const deps = await buildDeps();
    const prompter = new OverwritePrompter();
    const distContent = JSON.stringify({ a: "framework-a" });

    const result = await new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
      mergeFiles: [
        {
          relativePath: "settings.json",
          sectionKey: null,
          entries: { a: FileHash.of(JSON.stringify("original-a")) },
        },
      ],
      distMap: new Map([
        [
          "settings.json",
          new InstallationFile({
            relativePath: "settings.json",
            content: distContent,
            hash: FileHash.of(distContent),
            mergeStrategy: "framework-prime",
          }),
        ],
      ]),
      projectRoot: PROJECT_ROOT,
      force: false,
      interactive: false,
      fileFilter: null,
    });

    expect(result?.restored).toEqual(["settings.json"]);
    expect(result?.kept).toEqual([]);
    const content = deps.fs.getFile(join(PROJECT_ROOT, "settings.json"));
    expect(content && JSON.parse(content)).toEqual({ a: "framework-a" });
  });

  it("throws InputRequiredError for a modified merge file when force=false and interactive=false, without writing", async () => {
    const deps = await buildDeps();
    const settingsPath = join(PROJECT_ROOT, "settings.json");
    await deps.fs.writeFile(settingsPath, JSON.stringify({ a: "disk-modified" }));
    const prompter = new OverwritePrompter();
    const distContent = JSON.stringify({ a: "framework-a" });

    await expect(
      new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
        mergeFiles: [
          {
            relativePath: "settings.json",
            sectionKey: null,
            entries: { a: FileHash.of(JSON.stringify("original-a")) },
          },
        ],
        distMap: new Map([
          [
            "settings.json",
            new InstallationFile({
              relativePath: "settings.json",
              content: distContent,
              hash: FileHash.of(distContent),
              mergeStrategy: "framework-prime",
            }),
          ],
        ]),
        projectRoot: PROJECT_ROOT,
        force: false,
        interactive: false,
        fileFilter: null,
      })
    ).rejects.toThrow(InputRequiredError);

    expect(deps.fs.getFile(settingsPath)).toBe(JSON.stringify({ a: "disk-modified" }));
  });

  it("keeps a modified merge file when interactive=true and the prompter chooses keep", async () => {
    const deps = await buildDeps();
    const settingsPath = join(PROJECT_ROOT, "settings.json");
    await deps.fs.writeFile(settingsPath, JSON.stringify({ a: "disk-modified" }));
    const prompter = new KeepPrompter();
    const distContent = JSON.stringify({ a: "framework-a" });

    const result = await new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
      mergeFiles: [
        {
          relativePath: "settings.json",
          sectionKey: null,
          entries: { a: FileHash.of(JSON.stringify("original-a")) },
        },
      ],
      distMap: new Map([
        [
          "settings.json",
          new InstallationFile({
            relativePath: "settings.json",
            content: distContent,
            hash: FileHash.of(distContent),
            mergeStrategy: "framework-prime",
          }),
        ],
      ]),
      projectRoot: PROJECT_ROOT,
      force: false,
      interactive: true,
      fileFilter: null,
    });

    expect(result?.kept).toEqual(["settings.json"]);
    expect(result?.restored).toEqual([]);
    expect(deps.fs.getFile(settingsPath)).toBe(JSON.stringify({ a: "disk-modified" }));
  });

  it("excludes merge files that fail the fileFilter predicate from drift collection entirely", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.json"), JSON.stringify({ x: "disk" }));
    await deps.fs.writeFile(join(PROJECT_ROOT, "b.json"), JSON.stringify({ x: "disk" }));
    const prompter = new OverwritePrompter();
    const distContent = JSON.stringify({ x: "framework" });
    const mergeFiles: MergeFileEntry[] = [
      { relativePath: "a.json", sectionKey: null, entries: { x: FileHash.of('"orig"') } },
      { relativePath: "b.json", sectionKey: null, entries: { x: FileHash.of('"orig"') } },
    ];

    const result = await new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
      mergeFiles,
      distMap: new Map([
        [
          "a.json",
          new InstallationFile({
            relativePath: "a.json",
            content: distContent,
            hash: FileHash.of(distContent),
            mergeStrategy: "framework-prime",
          }),
        ],
        [
          "b.json",
          new InstallationFile({
            relativePath: "b.json",
            content: distContent,
            hash: FileHash.of(distContent),
            mergeStrategy: "framework-prime",
          }),
        ],
      ]),
      projectRoot: PROJECT_ROOT,
      force: true,
      interactive: false,
      fileFilter: (relativePath) => relativePath === "a.json",
    });

    expect(result?.restored).toEqual(["a.json"]);
    expect(deps.fs.getFile(join(PROJECT_ROOT, "b.json"))).toBe(JSON.stringify({ x: "disk" }));
  });

  it("reports a drifted merge file as unrestorable when the distribution strategy is 'none'", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.json"), JSON.stringify({ x: "disk" }));
    const prompter = new OverwritePrompter();

    const result = await new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
      mergeFiles: [
        { relativePath: "a.json", sectionKey: null, entries: { x: FileHash.of('"orig"') } },
      ],
      distMap: new Map([
        [
          "a.json",
          new InstallationFile({
            relativePath: "a.json",
            content: JSON.stringify({ x: "framework" }),
            hash: FileHash.of(JSON.stringify({ x: "framework" })),
            mergeStrategy: "none",
          }),
        ],
      ]),
      projectRoot: PROJECT_ROOT,
      force: true,
      interactive: false,
      fileFilter: null,
    });

    expect(result?.unrestorable).toEqual(["a.json"]);
    expect(result?.restored).toEqual([]);
    expect(result?.kept).toEqual([]);
    expect(deps.fs.getFile(join(PROJECT_ROOT, "a.json"))).toBe(JSON.stringify({ x: "disk" }));
  });

  it("returns null when a merge file's distribution strategy is 'none' and nothing drifted", async () => {
    const deps = await buildDeps();
    const distContent = JSON.stringify({ x: "framework" });
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.json"), distContent);
    const prompter = new OverwritePrompter();

    const result = await new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
      mergeFiles: [
        {
          relativePath: "a.json",
          sectionKey: null,
          entries: { x: FileHash.of('"framework"') },
        },
      ],
      distMap: new Map([
        [
          "a.json",
          new InstallationFile({
            relativePath: "a.json",
            content: distContent,
            hash: FileHash.of(distContent),
            mergeStrategy: "none",
          }),
        ],
      ]),
      projectRoot: PROJECT_ROOT,
      force: true,
      interactive: false,
      fileFilter: null,
    });

    expect(result).toBeNull();
  });

  it("partitions multiple drifted merge files into restored and kept within a single call", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "a.json"), JSON.stringify({ x: "disk-a" }));
    await deps.fs.writeFile(join(PROJECT_ROOT, "b.json"), JSON.stringify({ x: "disk-b" }));
    const prompter = new ScriptedPrompter([
      ScriptedPrompter.answer.conflict("overwrite"),
      ScriptedPrompter.answer.conflict("keep"),
    ]);

    const distContentA = JSON.stringify({ x: "framework-a" });
    const distContentB = JSON.stringify({ x: "framework-b" });

    const result = await new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
      mergeFiles: [
        { relativePath: "a.json", sectionKey: null, entries: { x: FileHash.of('"orig-a"') } },
        { relativePath: "b.json", sectionKey: null, entries: { x: FileHash.of('"orig-b"') } },
      ],
      distMap: new Map([
        [
          "a.json",
          new InstallationFile({
            relativePath: "a.json",
            content: distContentA,
            hash: FileHash.of(distContentA),
            mergeStrategy: "framework-prime",
          }),
        ],
        [
          "b.json",
          new InstallationFile({
            relativePath: "b.json",
            content: distContentB,
            hash: FileHash.of(distContentB),
            mergeStrategy: "framework-prime",
          }),
        ],
      ]),
      projectRoot: PROJECT_ROOT,
      force: false,
      interactive: true,
      fileFilter: null,
    });

    expect(result?.restored).toEqual(["a.json"]);
    expect(result?.kept).toEqual(["b.json"]);
    expect(deps.fs.getFile(join(PROJECT_ROOT, "b.json"))).toBe(JSON.stringify({ x: "disk-b" }));
  });

  it("merges only the drifted tracked key, leaving an undrifted tracked key and an untracked key untouched", async () => {
    const deps = await buildDeps();
    const configPath = join(PROJECT_ROOT, "config.json");
    // On disk: toolPath drifted away from what the manifest recorded; timeout still
    // matches; sideNote is a user key the framework distribution never mentions at all.
    await deps.fs.writeFile(
      configPath,
      JSON.stringify({ toolPath: "/usr/local/old-tool", timeout: 30, sideNote: "keep-me" })
    );
    const prompter = new OverwritePrompter();
    // The framework distribution only ever manages toolPath and timeout - sideNote
    // never appears in it, proving a merge restore cannot behave as a whole-file replace.
    const distContent = JSON.stringify({ toolPath: "/usr/local/new-tool", timeout: 30 });

    const result = await new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
      mergeFiles: [
        {
          relativePath: "config.json",
          sectionKey: null,
          entries: {
            toolPath: FileHash.of(JSON.stringify("/usr/local/expected-tool")),
            timeout: FileHash.of(JSON.stringify(30)),
          },
        },
      ],
      distMap: new Map([
        [
          "config.json",
          new InstallationFile({
            relativePath: "config.json",
            content: distContent,
            hash: FileHash.of(distContent),
            mergeStrategy: "framework-prime",
          }),
        ],
      ]),
      projectRoot: PROJECT_ROOT,
      force: true,
      interactive: false,
      fileFilter: null,
    });

    expect(result?.restored).toEqual(["config.json"]);
    const content = deps.fs.getFile(configPath);
    expect(content && JSON.parse(content)).toEqual({
      toolPath: "/usr/local/new-tool",
      timeout: 30,
      sideNote: "keep-me",
    });
  });
});
