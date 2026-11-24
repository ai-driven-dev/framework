import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type EnabledEntryOf,
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

const withoutEntry: WithoutEnabledPlugin = (shared, key, entry) => {
  const entries = Object.entries(shared[key ?? ""] ?? {}).filter(([ref]) => ref !== entry);
  return { ...shared, [key ?? ""]: Object.fromEntries(entries) };
};

const withoutEntryHeld: WithoutEnabledPlugin = (shared, key, entry) =>
  Object.hasOwn(shared[key ?? ""] ?? {}, entry) ? withoutEntry(shared, key, entry) : null;

const enabledEntryRef: EnabledEntryOf = (settings, { name, marketplace }, hostRef) =>
  settings.requiresNativeProof() ? hostRef : `${name}@${marketplace}`;

function setup(content: string) {
  const fs = new InMemoryFileAdapter({ [ABSOLUTE]: content }, [ROOT]);
  const manifest = aManifest()
    .withTool(TOOL.claude, [
      new InstallationFile({ relativePath: PATH, content, hash: FileHash.of(content) }),
    ])
    .build();
  const tracked = trackedSharedSettings({ fs, logger: new CapturingLogger() });
  return { fs, manifest, useCase: new RemoveEnabledPlugin(tracked, withoutEntry, enabledEntryRef) };
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

  it("drops the entry on the name the host gave the marketplace, not the alias it is registered under", async () => {
    const copilotPath = ".github/copilot/settings.json";
    const absolute = resolve(ROOT, copilotPath);
    const before = JSON.stringify({
      enabledPlugins: { "aidd-dev@hosted-name": true, "aidd-dev@other": true },
    });
    const fs = new InMemoryFileAdapter({ [absolute]: before }, [ROOT]);
    const manifest = aManifest()
      .withTool(TOOL.copilot, [
        new InstallationFile({
          relativePath: copilotPath,
          content: before,
          hash: FileHash.of(before),
        }),
      ])
      .build();
    const useCase = new RemoveEnabledPlugin(
      trackedSharedSettings({ fs, logger: new CapturingLogger() }),
      withoutEntry,
      enabledEntryRef
    );

    await useCase.execute({
      plugin: plugin("alias"),
      tool: registeredTools().aiProfile(TOOL.copilot),
      projectRoot: ROOT,
      manifest,
      hostRef: "aidd-dev@hosted-name",
    });

    expect(JSON.parse(await fs.readFile(absolute))).toEqual({
      enabledPlugins: { "aidd-dev@other": true },
    });
  });

  it("neither warns of a rewrite nor writes when the settings file is malformed, since it holds no entry to take out", async () => {
    const malformed = '{"enabledPlugins": {"aidd-dev@local": true},}';
    const fs = new InMemoryFileAdapter({ [ABSOLUTE]: malformed }, [ROOT]);
    const logger = new CapturingLogger();
    const manifest = aManifest().withTool(TOOL.claude, []).build();
    const useCase = new RemoveEnabledPlugin(
      trackedSharedSettings({ fs, logger }),
      withoutEntryHeld,
      enabledEntryRef
    );

    await useCase.execute({ plugin: plugin("local"), tool, projectRoot: ROOT, manifest });

    expect(logger.warnMessages).toEqual([]);
    expect(await fs.readFile(ABSOLUTE)).toBe(malformed);
  });
});
