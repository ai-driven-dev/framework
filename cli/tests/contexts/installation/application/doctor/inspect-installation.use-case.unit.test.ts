import { describe, expect, it } from "vitest";
import type { CheckPluginDriftRequest } from "../../../../../src/contexts/installation/application/doctor/check-plugin-drift.use-case.js";
import { InspectInstallation } from "../../../../../src/contexts/installation/application/doctor/inspect-installation.use-case.js";
import type { DoctorIssue } from "../../../../../src/contexts/installation/contract/doctor-issue.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const file = new InstallationFile({
  relativePath: "a.md",
  content: "x",
  hash: new FileHash("abc123abc123abc123abc123abc123ab"),
});
const issue = (message: string): DoctorIssue => ({
  severity: "warning",
  message,
  fix: { code: "restore-or-sync" },
});
const answering = (message: string) => ({ execute: async () => [issue(message)] });

function inspectionOver(repo: InMemoryManifestRepository, asked: CheckPluginDriftRequest[] = []) {
  return new InspectInstallation({
    manifestRepo: repo,
    tracked: answering("tracked"),
    merge: answering("merge"),
    references: answering("references"),
    plugin: {
      execute: async (request) => {
        asked.push(request);
        return [];
      },
    },
  });
}

const installed = () =>
  new InMemoryManifestRepository(
    aManifest().withTool(TOOL.claude, [file]).withTool(TOOL.cursor, []).build()
  );
const request = (allowedIds: Set<string> | null = null, pluginName?: string) => ({
  projectRoot: "/p",
  allowedIds,
  pluginName,
});

describe("inspecting the installation for the doctor", () => {
  it("answers the health of every installed tool", async () => {
    const { toolHealth } = await inspectionOver(installed()).execute(request());

    expect(toolHealth).toEqual([
      { toolId: TOOL.claude, fileCount: 1, mergeFileCount: 0 },
      { toolId: TOOL.cursor, fileCount: 0, mergeFileCount: 0 },
    ]);
  });

  it("reports health only for the allowed tools", async () => {
    const { toolHealth } = await inspectionOver(installed()).execute(
      request(new Set([TOOL.cursor]))
    );

    expect(toolHealth.map((h) => h.toolId)).toEqual([TOOL.cursor]);
  });

  it("lists the file issues in the order of the checks: tracked, merge, references", async () => {
    const { fileIssues } = await inspectionOver(installed()).execute(request());

    expect(fileIssues.map((i) => i.message)).toEqual(["tracked", "merge", "references"]);
  });

  it("checks the drift of the plugin the request names", async () => {
    const asked: CheckPluginDriftRequest[] = [];
    await inspectionOver(installed(), asked).execute(request(null, "aidd-dev"));

    expect(asked).toEqual([request(null, "aidd-dev")]);
  });

  it("fails with the loader's error when no manifest exists", async () => {
    await expect(
      inspectionOver(new InMemoryManifestRepository()).execute(request())
    ).rejects.toMatchObject({ code: "manifest-missing" });
  });
});
