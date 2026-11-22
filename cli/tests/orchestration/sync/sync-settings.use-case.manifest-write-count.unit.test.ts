import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import {
  SYNTHETIC_LISTED_TOOL,
  SYNTHETIC_NATIVE_TOOL,
  syntheticSyncCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import {
  FRAMEWORK_ONLY,
  MARKETPLACE,
  manifestWrites,
  PLUGIN,
  PROJECT_ROOT,
  SETTINGS_ABSOLUTE,
} from "../testing/manifest-writes.builder.js";

const { build, recorded, trackedSettingsHash } = manifestWrites(
  syntheticSyncCatalog(),
  SYNTHETIC_NATIVE_TOOL
);

describe("how many times the manifest is written back", () => {
  it("zero times when a run changed nothing, writing no project file either", async () => {
    const activator = new FakeHostActions({ available: false });
    const { useCase, manifestRepo, fs } = await build({
      toolIds: [SYNTHETIC_NATIVE_TOOL, SYNTHETIC_LISTED_TOOL],
      activator,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(manifestRepo.saves).toBe(0);
    expect(fs.listUnder(resolve(PROJECT_ROOT))).toStrictEqual([]);
  });

  it("once when only the settings file changed", async () => {
    const activator = new FakeHostActions({ available: false });
    const { useCase, manifestRepo, fs } = await build({ withPlugin: true, activator });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(manifestRepo.saves).toBe(1);
    expect(JSON.parse(await fs.readFile(SETTINGS_ABSOLUTE))).toStrictEqual({
      enabledPlugins: { [`${PLUGIN}@${MARKETPLACE}`]: true },
    });
  });

  it("once when only the host registration changed", async () => {
    const { useCase, manifestRepo, manifest } = await build();

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(manifestRepo.saves).toBe(1);
    expect(recorded(manifest)).toStrictEqual(FRAMEWORK_ONLY);
  });

  it("once across two identical runs: the second finds nothing to record", async () => {
    const { useCase, manifestRepo } = await build({
      trackedSettings: "{}",
      settingsOnDisk: "{}",
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(manifestRepo.saves).toBe(1);
  });

  it("never on a second run that enables the same plugin ref again", async () => {
    const activator = new FakeHostActions({ available: true });
    const { useCase, manifestRepo, manifest } = await build({ withPlugin: true, activator });
    await useCase.execute({ projectRoot: PROJECT_ROOT });
    const afterFirstRun = manifestRepo.saves;

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(manifestRepo.saves).toBe(afterFirstRun);
    expect(recorded(manifest)?.pluginRefs).toStrictEqual([`${PLUGIN}@${MARKETPLACE}`]);
  });

  it("once when only the tracked settings hash moved under the host's own write", async () => {
    const onDisk = JSON.stringify({ model: "opus" });
    const { useCase, manifestRepo, manifest } = await build({
      trackedSettings: "{}",
      settingsOnDisk: onDisk,
      existingRegistrations: FRAMEWORK_ONLY,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(manifestRepo.saves).toBe(1);
    expect(trackedSettingsHash(manifest)).toBe(FileHash.of(onDisk).value);
  });

  it("once when the marketplaces key is evicted from the shared settings file", async () => {
    const activator = new FakeHostActions({ available: false });
    const onDisk = JSON.stringify({
      extraKnownMarketplaces: { x: { source: "/p" } },
      model: "opus",
    });
    const { useCase, manifestRepo, manifest, fs } = await build({
      trackedSettings: onDisk,
      settingsOnDisk: onDisk,
      activator,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    const written = await fs.readFile(SETTINGS_ABSOLUTE);
    expect(manifestRepo.saves).toBe(1);
    expect(JSON.parse(written)).toStrictEqual({ model: "opus" });
    expect(trackedSettingsHash(manifest)).toBe(FileHash.of(written).value);
  });
});

describe("what the tracked settings hash follows", () => {
  it("stays where it was when the tracked file is gone from disk", async () => {
    const { useCase, manifest } = await build({ trackedSettings: "{}" });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(result.errors).toStrictEqual([]);
    expect(trackedSettingsHash(manifest)).toBe(FileHash.of("{}").value);
  });

  it("never starts tracking the settings file on behalf of another tracked file", async () => {
    const { useCase, manifest } = await build({
      otherTrackedFiles: ["CLAUDE.md"],
      settingsOnDisk: "{}",
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(
      manifest.getToolFiles(SYNTHETIC_NATIVE_TOOL).map((file) => file.relativePath)
    ).toStrictEqual(["CLAUDE.md"]);
  });
});
