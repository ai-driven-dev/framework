import { describe, expect, it } from "vitest";
import { CheckMergeFiles } from "../../../../../src/contexts/installation/application/doctor/check-merge-files.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/project";
const MERGE_PATH = ".vscode/settings.json";
const KEY = "editor.formatOnSave";

const MISSING_FILE = {
  severity: "error",
  message: `Missing merge file: ${MERGE_PATH}`,
  fix: { code: "sync-force", effect: "reinstall-files" },
};
const MISSING_KEY = {
  severity: "error",
  message: `Missing key in ${MERGE_PATH} > ${KEY}`,
  fix: { code: "sync-force", effect: "restore-keys" },
};
const MODIFIED_KEY = {
  severity: "warning",
  message: `Modified key in ${MERGE_PATH} > ${KEY}`,
  fix: { code: "sync-force", effect: "restore-value" },
};

function manifestMerging(toolId: ToolId): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(toolId, "1.0.0", []);
  manifest.updateToolMergeFiles(toolId, [
    { relativePath: MERGE_PATH, sectionKey: null, entries: { [KEY]: FileHash.of("true") } },
  ]);
  return manifest;
}

async function issuesFor(
  onDisk: string | null,
  allowedIds: Set<string> | null = null,
  toolId: ToolId = TOOL.vscode
) {
  const fs = new InMemoryFileAdapter(
    onDisk === null ? {} : { [`${PROJECT_ROOT}/${MERGE_PATH}`]: onDisk }
  );
  const load = new InMemoryManifestRepository(manifestMerging(toolId));
  return new CheckMergeFiles(load, fs).execute({
    projectRoot: PROJECT_ROOT,
    allowedIds,
  });
}

describe("checking the merge files", () => {
  describe("a merge file", () => {
    it("reports nothing when every managed key holds its recorded value", async () => {
      expect(await issuesFor(`{ "${KEY}": true }`)).toStrictEqual([]);
    });

    it("reports one error naming the file when it is gone from disk", async () => {
      expect(await issuesFor(null)).toStrictEqual([MISSING_FILE]);
    });

    it("reports one error naming the key when the file no longer holds it", async () => {
      expect(await issuesFor("{}")).toStrictEqual([MISSING_KEY]);
    });

    it("reports one warning naming the key when its value changed", async () => {
      expect(await issuesFor(`{ "${KEY}": false }`)).toStrictEqual([MODIFIED_KEY]);
    });
  });

  describe("narrowed to a set of tools", () => {
    it("ignores a missing merge file of a tool outside the set", async () => {
      expect(await issuesFor(null, new Set(["claude"]))).toStrictEqual([]);
    });

    it("still reports a missing merge file of a tool inside the set", async () => {
      expect(await issuesFor(null, new Set(["vscode"]))).toStrictEqual([MISSING_FILE]);
    });
  });
});
