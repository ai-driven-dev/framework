import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/installation.js";
import { RecordActivation } from "../../../../../src/contexts/installation/application/sync/record-activation.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { registeredCatalog } from "../../../../shared/testing/catalog-of.builder.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const { claude } = TOOL;
const ROOT = "/project";
const SETTINGS =
  registeredTools().aiProfileIfAny(claude)?.marketplaceRegistration()?.sharedSettingsFile() ?? "";

function trackedSettings(content: string) {
  return new InstallationFile({
    relativePath: SETTINGS,
    content,
    hash: FileHash.of(content),
  });
}

function setup(onDisk: string) {
  const fs = new InMemoryFileAdapter({ [resolve(ROOT, SETTINGS)]: onDisk });
  const manifest = aManifest()
    .withTool(claude, [trackedSettings("{}")])
    .build();
  const record = new RecordActivation(fs, registrationRecordRules, registeredCatalog());
  return { manifest, record };
}

describe("RecordActivation settings-written-by-host", () => {
  it("re-hashes a tracked settings file the host rewrote, once", async () => {
    const { manifest, record } = setup('{"host":true}');
    const request = {
      kind: "settings-written-by-host",
      projectRoot: ROOT,
      manifest,
      activated: [claude],
    } as const;

    await expect(record.execute(request)).resolves.toBe(true);
    expect(manifest.getToolFiles(claude)[0]?.hash).toEqual(FileHash.of('{"host":true}'));
    await expect(record.execute(request)).resolves.toBe(false);
  });

  it("changes nothing when the file on disk is the one tracked", async () => {
    const { manifest, record } = setup("{}");

    await expect(
      record.execute({
        kind: "settings-written-by-host",
        projectRoot: ROOT,
        manifest,
        activated: [claude],
      })
    ).resolves.toBe(false);
  });
});

describe("RecordActivation machine-claims", () => {
  it("changes nothing without a machine manifest to write to", async () => {
    const { manifest, record } = setup("{}");

    await expect(
      record.execute({
        kind: "machine-claims",
        project: manifest,
        outcomes: new Map(),
        marketplaces: [],
        scope: "user",
      })
    ).resolves.toBe(false);
  });
});
