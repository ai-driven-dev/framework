import { describe, expect, it } from "vitest";
import {
  CheckTrackedFiles,
  collectTrackedFiles,
} from "../../../../../src/contexts/installation/application/doctor/check-tracked-files.use-case.js";
import { LoadManifest } from "../../../../../src/contexts/installation/application/doctor/load-manifest.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/project";
const FILE = ".claude/rules/one.md";
const CONTENT = "one\n";

const MISSING = {
  severity: "error",
  message: `Missing tracked file: ${FILE}`,
  fix: { code: "restore-or-sync" },
};
const MODIFIED = {
  severity: "warning",
  message: `Modified tracked file: ${FILE}`,
  fix: { code: "sync-force", effect: "revert-file" },
};

function manifestTracking(toolId: ToolId): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(toolId, "1.0.0", [
    new InstallationFile({ relativePath: FILE, content: CONTENT, hash: FileHash.of(CONTENT) }),
  ]);
  return manifest;
}

async function issuesFor(
  onDisk: string | null,
  allowedIds: Set<string> | null = null,
  toolId: ToolId = TOOL.claude
) {
  const fs = new InMemoryFileAdapter(
    onDisk === null ? {} : { [`${PROJECT_ROOT}/${FILE}`]: onDisk }
  );
  const load = new LoadManifest(new InMemoryManifestRepository(manifestTracking(toolId)));
  return new CheckTrackedFiles(load, fs).execute({
    projectRoot: PROJECT_ROOT,
    allowedIds,
  });
}

describe("CheckTrackedFiles", () => {
  describe("a tracked file", () => {
    it("reports nothing when the disk matches the manifest", async () => {
      expect(await issuesFor(CONTENT)).toStrictEqual([]);
    });

    it("reports one error naming the file when it is gone from disk", async () => {
      expect(await issuesFor(null)).toStrictEqual([MISSING]);
    });

    it("reports one warning naming the file when its content changed", async () => {
      expect(await issuesFor("edited\n")).toStrictEqual([MODIFIED]);
    });
  });

  describe("narrowed to a set of tools", () => {
    it("ignores a missing file of a tool outside the set", async () => {
      expect(await issuesFor(null, new Set(["cursor"]))).toStrictEqual([]);
    });

    it("ignores a modified file of a tool outside the set", async () => {
      expect(await issuesFor("edited\n", new Set(["cursor"]))).toStrictEqual([]);
    });

    it("still reports a missing file of a tool inside the set", async () => {
      expect(await issuesFor(null, new Set(["claude"]))).toStrictEqual([MISSING]);
    });

    it("still reports a modified file of a tool inside the set", async () => {
      expect(await issuesFor("edited\n", new Set(["claude"]))).toStrictEqual([MODIFIED]);
    });
  });

  describe("collectTrackedFiles", () => {
    it("pairs every tracked file with the tool that owns it", () => {
      const collected = collectTrackedFiles(manifestTracking(TOOL.claude), null);

      expect(collected.map((f) => [f.relativePath, f.toolId])).toStrictEqual([[FILE, "claude"]]);
    });
  });
});
