import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RestoreDriftEntries } from "../../../../../src/contexts/installation/application/restore/restore-drift-entries.use-case.js";
import { RestoreMergeFiles } from "../../../../../src/contexts/installation/application/restore/restore-merge-files.use-case.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import type { MergeFileEntry } from "../../../../../src/shared/domain/merge.js";
import { buildInstallationDeps } from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools } from "../../../../shared/testing/registered-tools.builder.js";
import {
  KeepPrompter,
  OverwritePrompter,
} from "../../../../shared/testing/scripted-prompter.fake.js";

const PROJECT_ROOT = "/test-project";

async function buildDeps() {
  return buildInstallationDeps({ tools: registeredTools() });
}

describe("restoreMergeFiles - the entries it hands back", () => {
  const distContent = JSON.stringify({ a: "framework-a" });

  function distMapFor() {
    return new Map([
      [
        "settings.json",
        new InstallationFile({
          relativePath: "settings.json",
          content: distContent,
          hash: FileHash.of(distContent),
          mergeStrategy: "framework-prime",
        }),
      ],
    ]);
  }

  it("re-reads the entries of a restored merge file from what landed on disk", async () => {
    const deps = await buildDeps();
    const prompter = new OverwritePrompter();

    const result = await new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
      mergeFiles: [
        {
          relativePath: "settings.json",
          sectionKey: null,
          entries: { a: FileHash.of(JSON.stringify("original-a")) },
        },
      ],
      distMap: distMapFor(),
      projectRoot: PROJECT_ROOT,
      force: true,
      interactive: false,
      fileFilter: null,
    });

    expect(result?.updatedMergeFiles).toStrictEqual([
      {
        relativePath: "settings.json",
        sectionKey: null,
        entries: { a: FileHash.of(JSON.stringify("framework-a")) },
      },
    ]);
  });

  it("hands back a kept merge file's entries exactly as they were tracked", async () => {
    const deps = await buildDeps();
    await deps.fs.writeFile(join(PROJECT_ROOT, "settings.json"), JSON.stringify({ a: "disk" }));
    const tracked: MergeFileEntry = {
      relativePath: "settings.json",
      sectionKey: null,
      entries: { a: FileHash.of(JSON.stringify("original-a")) },
    };
    const prompter = new KeepPrompter();

    const result = await new RestoreMergeFiles(deps.fs, new RestoreDriftEntries(prompter)).execute({
      mergeFiles: [tracked],
      distMap: distMapFor(),
      projectRoot: PROJECT_ROOT,
      force: false,
      interactive: true,
      fileFilter: null,
    });

    expect(result?.updatedMergeFiles).toStrictEqual([tracked]);
  });
});
