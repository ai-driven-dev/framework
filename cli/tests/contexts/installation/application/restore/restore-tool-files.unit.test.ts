import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RestoreToolFilesCommand } from "../../../../../src/contexts/installation/application/restore/restore-tool-files.js";
import { FrameworkDescriptor } from "../../../../../src/contexts/installation/domain/canon.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash, InstallationFile } from "../../../../../src/shared/domain/file.js";
import type { Prompter } from "../../../../../src/shared/ports/prompter.js";
import { restoreToolFilesOf } from "../../../../helpers/ports/build-restore.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { TOOL } from "../../../../shared/testing/registered-tools.js";
import { KeepPrompter, OverwritePrompter } from "../../../../shared/testing/scripted-prompter.js";

const PROJECT_ROOT = "/test-project";
const KEYBINDINGS = ".vscode/keybindings.json";
const EXTENSIONS = ".vscode/extensions.json";
const GHOST = ".vscode/ghost.json";
const KEYBINDINGS_CONTENT = '[{"key":"ctrl+k","command":"noop"}]';
const EXTENSIONS_CONTENT = '{"recommendations":["a.ext"]}';

const descriptor = new FrameworkDescriptor({
  version: "test",
  contentSections: [],
  templateRefs: [],
  configRefs: [
    { name: "vscodeKeybindings", path: "config/vscode/keybindings.json" },
    { name: "vscodeExtensions", path: "config/vscode/extensions.json" },
  ],
});

function contentFiles(extensions = EXTENSIONS_CONTENT): Map<string, string> {
  return new Map([
    ["config/vscode/keybindings.json", KEYBINDINGS_CONTENT],
    ["config/vscode/extensions.json", extensions],
  ]);
}

interface Installed {
  fs: InMemoryFileAdapter;
  manifest: Manifest;
}

function installedVscode(extraTracked: string[] = []): Installed {
  const fs = new InMemoryFileAdapter({
    [join(PROJECT_ROOT, KEYBINDINGS)]: KEYBINDINGS_CONTENT,
    [join(PROJECT_ROOT, EXTENSIONS)]: EXTENSIONS_CONTENT,
  });
  const manifest = Manifest.create();
  manifest.addTool(
    TOOL.vscode,
    "test",
    [KEYBINDINGS, ...extraTracked].map(
      (relativePath) =>
        new InstallationFile({
          relativePath,
          content: "",
          hash: FileHash.of(relativePath === KEYBINDINGS ? KEYBINDINGS_CONTENT : relativePath),
        })
    ),
    [
      {
        relativePath: EXTENSIONS,
        sectionKey: null,
        entries: { recommendations: FileHash.of(JSON.stringify(["a.ext"])) },
      },
    ]
  );
  return { fs, manifest };
}

function restore(
  installed: Installed,
  overrides: Partial<RestoreToolFilesCommand> = {},
  prompter: Prompter = new OverwritePrompter(),
  logger = new CapturingLogger()
) {
  return restoreToolFilesOf({
    fs: installed.fs,

    logger,
    prompter,
  }).execute({
    toolId: TOOL.vscode,
    manifest: installed.manifest,
    descriptor,
    contentFiles: contentFiles(),
    projectRoot: PROJECT_ROOT,
    version: "test",
    force: true,
    interactive: false,
    fileFilter: null,
    ...overrides,
  });
}

describe("RestoreToolFiles — what it reports", () => {
  it("announces the tool it is checking", async () => {
    const installed = installedVscode();
    const logger = new CapturingLogger();

    await restore(installed, {}, new OverwritePrompter(), logger);

    expect(logger.infoMessages).toStrictEqual(["Checking vscode for files to restore..."]);
  });

  it("reports nothing to restore when every tracked file and key is intact", async () => {
    const result = await restore(installedVscode());

    expect(result).toStrictEqual({
      toolId: TOOL.vscode,
      nothingToRestore: true,
      restored: [],
      kept: [],
      unrestorable: [],
    });
  });

  it("lists what it restored and what it could not, across both sections", async () => {
    const installed = installedVscode([GHOST]);
    await installed.fs.writeFile(join(PROJECT_ROOT, KEYBINDINGS), "[]");
    await installed.fs.deleteFile(join(PROJECT_ROOT, EXTENSIONS));

    const result = await restore(installed);

    expect(result).toStrictEqual({
      toolId: TOOL.vscode,
      nothingToRestore: false,
      restored: [KEYBINDINGS, EXTENSIONS],
      kept: [],
      unrestorable: [GHOST],
    });
  });

  it("lists a modified file the user chose to keep", async () => {
    const installed = installedVscode();
    await installed.fs.writeFile(join(PROJECT_ROOT, KEYBINDINGS), "[]");

    const result = await restore(
      installed,
      { force: false, interactive: true },
      new KeepPrompter()
    );

    expect(result).toStrictEqual({
      toolId: TOOL.vscode,
      nothingToRestore: false,
      restored: [],
      kept: [KEYBINDINGS],
      unrestorable: [],
    });
  });
});

describe("RestoreToolFiles — what it records", () => {
  it("keeps the version the tool was installed at, not the one the restore runs with", async () => {
    const installed = installedVscode();
    await installed.fs.writeFile(join(PROJECT_ROOT, KEYBINDINGS), "[]");

    await restore(installed, { version: "9.9.9" });

    expect(installed.manifest.getToolVersion(TOOL.vscode)).toBe("test");
  });

  it("keeps tracking the merge files when only a regular file was restored", async () => {
    const installed = installedVscode();
    const before = [...installed.manifest.getMergeFiles(TOOL.vscode)];
    await installed.fs.writeFile(join(PROJECT_ROOT, KEYBINDINGS), "[]");

    await restore(installed);

    expect(installed.manifest.getMergeFiles(TOOL.vscode)).toStrictEqual(before);
  });

  it("keeps tracking the regular files when only a merge file was restored", async () => {
    const installed = installedVscode();
    const before = [...installed.manifest.getToolFiles(TOOL.vscode)];
    await installed.fs.deleteFile(join(PROJECT_ROOT, EXTENSIONS));

    await restore(installed);

    expect(installed.manifest.getToolFiles(TOOL.vscode)).toStrictEqual(before);
  });

  it("tracks every key the distribution now writes into a restored merge file", async () => {
    const installed = installedVscode();
    await installed.fs.deleteFile(join(PROJECT_ROOT, EXTENSIONS));

    await restore(installed, {
      contentFiles: contentFiles(
        '{"recommendations":["a.ext"],"unwantedRecommendations":["b.ext"]}'
      ),
    });

    expect(installed.manifest.getMergeFiles(TOOL.vscode)).toStrictEqual([
      {
        relativePath: EXTENSIONS,
        sectionKey: null,
        entries: {
          recommendations: FileHash.of(JSON.stringify(["a.ext"])),
          unwantedRecommendations: FileHash.of(JSON.stringify(["b.ext"])),
        },
      },
    ]);
  });
});
