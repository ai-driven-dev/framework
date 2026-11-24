import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RemoveEnabledPlugin,
  type WithoutEnabledPlugin,
} from "../../../../../../src/contexts/installation/application/removal/project/remove-enabled-plugin.use-case.js";
import { trackedSharedSettings } from "../../../../../../src/contexts/installation/application/sync/tracked-shared-settings.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../../src/shared/domain/installation-file.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../../testing/manifest.builder.js";

const ROOT = "/project";
const PATH = ".claude/settings.json";
const ABSOLUTE = resolve(ROOT, PATH);
const tool = registeredTools().aiProfile(TOOL.claude);

function plugin(marketplace?: string): RecordedPlugin {
  return RecordedPlugin.fromMetadata({
    name: "aidd-dev",
    version: "1.0.0",
    source: { kind: "local", path: "/fixture" },
    strict: false,
    scope: "project",
    marketplace,
  });
}

const withoutEntry: WithoutEnabledPlugin = (shared, key, { name, marketplace }) => {
  const entries = Object.entries(shared[key ?? ""] ?? {}).filter(
    ([ref]) => ref !== `${name}@${marketplace}`
  );
  return { ...shared, [key ?? ""]: Object.fromEntries(entries) };
};

function setup(content: string) {
  const fs = new InMemoryFileAdapter({ [ABSOLUTE]: content }, [ROOT]);
  const manifest = aManifest()
    .withTool(TOOL.claude, [
      new InstallationFile({ relativePath: PATH, content, hash: FileHash.of(content) }),
    ])
    .build();
  const tracked = trackedSharedSettings({ fs, logger: new CapturingLogger() });
  return { fs, manifest, useCase: new RemoveEnabledPlugin(tracked, withoutEntry) };
}

describe("removing the entry that enabled a plugin", () => {
  it("drops that entry only, and keeps the tracked hash in step", async () => {
    const before = JSON.stringify({
      enabledPlugins: { "aidd-dev@local": true, "other@local": true },
    });
    const { fs, manifest, useCase } = setup(before);

    await useCase.execute({ plugin: plugin("local"), tool, projectRoot: ROOT, manifest });

    const after = await fs.readFile(ABSOLUTE);
    expect(JSON.parse(after)).toEqual({ enabledPlugins: { "other@local": true } });
    expect(FileHash.of(after)).not.toEqual(FileHash.of(before));
  });

  it("leaves the file alone for a plugin that came from no marketplace", async () => {
    const before = JSON.stringify({ enabledPlugins: { "aidd-dev@local": true } });
    const { fs, manifest, useCase } = setup(before);

    await useCase.execute({ plugin: plugin(), tool, projectRoot: ROOT, manifest });

    expect(await fs.readFile(ABSOLUTE)).toBe(before);
  });
});
