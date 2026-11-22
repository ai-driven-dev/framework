import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { trackedSharedSettings } from "../../../../../src/contexts/installation/application/sync/tracked-shared-settings.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const { claude } = TOOL;
const ROOT = "/project";
const PATH = ".claude/settings.json";
const ABSOLUTE = resolve(ROOT, PATH);

function trackedBy(onDisk?: string) {
  const content = "{}";
  const logger = new CapturingLogger();
  const fs = new InMemoryFileAdapter(onDisk === undefined ? {} : { [ABSOLUTE]: onDisk });
  const manifest = aManifest()
    .withTool(claude, [
      new InstallationFile({ relativePath: PATH, content, hash: FileHash.of(content) }),
    ])
    .build();
  return { logger, fs, manifest, settings: trackedSharedSettings({ fs, logger }) };
}

describe("TrackedSharedSettings read", () => {
  it("starts from nothing when the file does not exist", async () => {
    const { settings, logger } = trackedBy();

    await expect(settings.read(ROOT, PATH)).resolves.toEqual({});
    expect(logger.warnMessages).toEqual([]);
  });

  it("returns the parsed object", async () => {
    const { settings } = trackedBy('{"keep":1}');

    await expect(settings.read(ROOT, PATH)).resolves.toEqual({ keep: 1 });
  });

  it("warns and starts from nothing when the file holds malformed JSON", async () => {
    const { settings, logger } = trackedBy('{"enabledPlugins": {},}');

    await expect(settings.read(ROOT, PATH)).resolves.toEqual({});
    expect(logger.warnMessages).toEqual([
      `Ignoring malformed JSON in ${ABSOLUTE}; rewriting the keys this CLI owns.`,
    ]);
  });

  it("starts from nothing when the file holds no object", async () => {
    const { settings } = trackedBy('["x"]');

    await expect(settings.read(ROOT, PATH)).resolves.toEqual({});
  });
});

describe("TrackedSharedSettings write", () => {
  it("writes the file indented and records its hash in the manifest", async () => {
    const { settings, fs, manifest } = trackedBy();
    const content = JSON.stringify({ keep: 1 }, null, 2);

    await settings.write({ projectRoot: ROOT, path: PATH, manifest, toolId: claude }, { keep: 1 });

    await expect(fs.readFile(ABSOLUTE)).resolves.toBe(content);
    expect(manifest.getToolFiles(claude)[0]?.hash).toEqual(FileHash.of(content));
  });
});
