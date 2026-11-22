import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { settingsDeclaration } from "../../../src/composition/host-registration.js";
import { registrationRecordRules } from "../../../src/composition/installation.js";
import type { HostRegistrationOutcome } from "../../../src/contexts/host-registration/application/register/registration-outcome.js";
import { BuildMarketplaceForTool } from "../../../src/contexts/installation/application/sync/build-marketplace-for-tool.use-case.js";
import { trackedSharedSettings } from "../../../src/contexts/installation/application/sync/tracked-shared-settings.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { SyncToolSettingsFiles } from "../../../src/orchestration/sync/sync-tool-settings-files.use-case.js";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../src/shared/domain/installation-file.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";

const { claude, copilot } = TOOL;
const ROOT = "/project";
const MARKETPLACE = {
  name: "aidd-framework",
  source: { kind: "github", repo: "ai-driven-dev/framework" },
  scope: "project",
} as const;

function settingsOf(tool: typeof claude | typeof copilot): string {
  return (
    registeredTools().aiProfileIfAny(tool)?.marketplaceRegistration()?.sharedSettingsFile() ?? ""
  );
}

function pluginOf(name: string): RecordedPlugin {
  return RecordedPlugin.fromJSON({
    name,
    source: { kind: "github", repo: `owner/${name}` },
    version: "1.0.0",
    strict: false,
    files: {},
    scope: "project",
    marketplace: MARKETPLACE.name,
  });
}

function setup(tool: typeof claude | typeof copilot, onDisk: Record<string, unknown> | string) {
  const path = settingsOf(tool);
  const logger = new CapturingLogger();
  const content = typeof onDisk === "string" ? onDisk : JSON.stringify(onDisk);
  const fs = new InMemoryFileAdapter({ [resolve(ROOT, path)]: content });
  const built: string[] = [];
  const manifest = aManifest()
    .withTool(tool, [
      new InstallationFile({ relativePath: path, content, hash: FileHash.of(content) }),
    ])
    .withPlugin(tool, pluginOf("aidd-context"))
    .build();
  const sync = new SyncToolSettingsFiles(
    {
      tracked: trackedSharedSettings({ fs, logger }),
      buildMarketplace: new BuildMarketplaceForTool(
        {
          execute: async (request) => {
            built.push(`${request.target}:${request.marketplace.name}`);
            return fakeEnsureBuiltMarketplace().execute(request);
          },
        },
        logger,
        registeredTools()
      ),
      declaration: settingsDeclaration,
      refs: registrationRecordRules,
    },
    registeredTools()
  );
  return { sync, fs, manifest, built, path: resolve(ROOT, path), relative: path };
}

const request = (manifest: ReturnType<typeof setup>["manifest"]) =>
  ({ projectRoot: ROOT, manifest, marketplaces: [MARKETPLACE] }) as const;

describe("SyncToolSettingsFiles project-tools", () => {
  it("enables the manifest's plugins in the file as the eviction wrote it", async () => {
    const { sync, fs, manifest, path, relative } = setup(claude, {
      extraKnownMarketplaces: { stale: {} },
      keep: 1,
    });

    const changed = await sync.execute({
      ...request(manifest),
      kind: "project-tools",
      toolIds: [claude],
    });

    const written = JSON.stringify(
      { keep: 1, enabledPlugins: { "aidd-context@aidd-framework": true } },
      null,
      2
    );
    expect(changed).toBe(true);
    await expect(fs.readFile(path)).resolves.toBe(written);
    expect(manifest.getToolFiles(claude).find((f) => f.relativePath === relative)?.hash).toEqual(
      FileHash.of(written)
    );
  });

  it("builds every marketplace for the tool, even when its settings need no change", async () => {
    const { sync, manifest, built } = setup(claude, {
      enabledPlugins: { "aidd-context@aidd-framework": true },
    });

    const changed = await sync.execute({
      ...request(manifest),
      kind: "project-tools",
      toolIds: [claude],
    });

    expect(changed).toBe(false);
    expect(built).toEqual(["claude:aidd-framework"]);
  });

  it("leaves a tool whose settings file needs the host's proof to the proven-plugins pass", async () => {
    const { sync, manifest, built } = setup(copilot, {});

    const changed = await sync.execute({
      ...request(manifest),
      kind: "project-tools",
      toolIds: [copilot],
    });

    expect(changed).toBe(false);
    expect(built).toEqual([]);
  });
});

describe("SyncToolSettingsFiles proven-plugins", () => {
  const outcome: HostRegistrationOutcome = {
    marketplaces: [{ alias: "aidd-framework", hostName: "host-name" }],
    preservedMarketplaces: [],
    catalogClaims: [],
    pluginRefs: ["proven@host-name", "other@elsewhere"],
    buildFailed: false,
  };

  it("enables only the refs the host proved, in the file of a tool that needs the proof", async () => {
    const { sync, fs, manifest, path } = setup(copilot, {});

    const changed = await sync.execute({
      ...request(manifest),
      kind: "proven-plugins",
      outcomes: new Map([[copilot, outcome]]),
    });

    expect(changed).toBe(true);
    expect(JSON.parse(await fs.readFile(path))).toEqual({
      enabledPlugins: { "proven@host-name": true },
    });
  });

  it("writes nothing for a tool whose settings file needs no proof", async () => {
    const { sync, fs, manifest, path } = setup(claude, {});

    const changed = await sync.execute({
      ...request(manifest),
      kind: "proven-plugins",
      outcomes: new Map([[claude, outcome]]),
    });

    expect(changed).toBe(false);
    await expect(fs.readFile(path)).resolves.toBe("{}");
  });
});
