import { resolve } from "node:path";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { RegistrationRecord } from "../../../src/contexts/host-registration/domain/record/registration-record.js";
import type { BuiltMarketplaceEnsurer } from "../../../src/contexts/installation/contract/built-marketplace.js";
import type { NativeRegistrations } from "../../../src/contexts/installation/domain/manifest/native-registrations.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../src/shared/domain/installation-file.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";

export const PROJECT_ROOT = "/test-project";
export const MARKETPLACE = "aidd-framework";
export const PLUGIN = "aidd-telemetry";
export const SETTINGS_PATH = ".claude/settings.json";
export const SETTINGS_ABSOLUTE = resolve(PROJECT_ROOT, SETTINGS_PATH);

export class SaveCountingManifestRepository extends InMemoryManifestRepository {
  saves = 0;

  override async save(manifest: Manifest): Promise<void> {
    this.saves += 1;
    return super.save(manifest);
  }
}

export interface Setup {
  readonly toolIds?: readonly ToolId[];
  readonly marketplaceNames?: readonly string[];
  readonly marketplaceScope?: Scope;
  readonly failingBuilds?: readonly string[];
  readonly activator?: FakeHostActions;
  readonly withPlugin?: boolean;
  readonly trackedSettings?: string;
  readonly settingsOnDisk?: string;
  readonly otherTrackedFiles?: readonly string[];
  readonly existingRegistrations?: NativeRegistrations;
  readonly existingMachineRegistrations?: NativeRegistrations;
  readonly hostRegisteredSource?: string;
}

function catalogPath(marketplace: string, target: string): string {
  const relative =
    target === "codex" ? ".agents/plugins/marketplace.json" : ".claude-plugin/marketplace.json";
  return `/built/${marketplace}/${target}/${relative}`;
}

function buildPerMarketplace(failing: readonly string[]): BuiltMarketplaceEnsurer {
  return {
    execute: async (options) => {
      if (failing.includes(options.marketplace.name)) throw new Error("no catalog at that source");
      return {
        builtDir: `/built/${options.marketplace.name}/${options.target}`,
        version: "test",
        rebuilt: true,
      };
    },
  };
}

function builtCatalogs(names: readonly string[], toolIds: readonly ToolId[]): InMemoryFileAdapter {
  const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
  for (const name of names) {
    for (const toolId of toolIds) {
      fs.setFile(
        catalogPath(name, toolId),
        JSON.stringify({ name, version: "1.0.0", plugins: [{ name: PLUGIN }] })
      );
    }
  }
  return fs;
}

function trackedFilesOf(setup: Setup): InstallationFile[] {
  const tracked = (setup.otherTrackedFiles ?? []).map(
    (relativePath) =>
      new InstallationFile({ relativePath, content: "# tracked", hash: FileHash.of("# tracked") })
  );
  if (setup.trackedSettings !== undefined) {
    tracked.push(
      new InstallationFile({
        relativePath: SETTINGS_PATH,
        content: setup.trackedSettings,
        hash: FileHash.of(setup.trackedSettings),
      })
    );
  }
  return tracked;
}

function installedPlugin(): RecordedPlugin {
  return RecordedPlugin.fromMetadata({
    name: PLUGIN,
    version: "1.0.0",
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    strict: true,
    scope: "project",
    marketplace: MARKETPLACE,
  });
}

function projectManifestOf(setup: Setup, toolIds: readonly ToolId[]): Manifest {
  const manifest = Manifest.create();
  const tracked = trackedFilesOf(setup);
  for (const toolId of toolIds)
    manifest.addTool(toolId, "test", toolId === "claude" ? tracked : []);
  if (setup.withPlugin === true) manifest.addPlugin(TOOL.claude, installedPlugin());
  if (setup.existingRegistrations !== undefined) {
    manifest.setNativeRegistrations(TOOL.claude, setup.existingRegistrations);
  }
  return manifest;
}

async function registeredMarketplaces(
  names: readonly string[],
  scope: Scope
): Promise<InMemoryMarketplaceRegistry> {
  const registry = new InMemoryMarketplaceRegistry();
  for (const name of names) {
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name,
        source: { kind: "github", repo: `ai-driven-dev/${name}` },
        scope,
        addedAt: "2026-09-02T00:00:00Z",
      })
    );
  }
  return registry;
}

function machineRepoOf(
  registrations: NativeRegistrations | undefined
): SaveCountingManifestRepository | undefined {
  if (registrations === undefined) return undefined;
  const machine = Manifest.create();
  machine.addTool(TOOL.claude, "test", []);
  machine.setNativeRegistrations(TOOL.claude, registrations);
  return new SaveCountingManifestRepository(machine);
}

function hostMarketplaceRegistriesOf(source: string | undefined) {
  if (source === undefined) return new Map();
  return new Map([
    [
      TOOL.claude,
      {
        read: async () => ({
          location: "/home/.claude/plugins/known_marketplaces.json",
          entries: new Map([[MARKETPLACE, source]]),
        }),
      },
    ],
  ]);
}

function nativeSourcesOf(
  activator: FakeHostActions,
  names: readonly string[],
  hostRegisteredSource: string | undefined
) {
  const known =
    hostRegisteredSource === undefined
      ? new Map()
      : new Map([[MARKETPLACE, { kind: "registry" as const, source: hostRegisteredSource }]]);
  return new Map([
    [
      TOOL.claude,
      new FakeHostMarketplaceSources(
        activator,
        "registry",
        (path) => names.find((name) => path === `/built/${name}/claude`),
        known
      ),
    ],
  ]);
}

export async function build(setup: Setup = {}) {
  const names = setup.marketplaceNames ?? [MARKETPLACE];
  const toolIds = setup.toolIds ?? [TOOL.claude];
  const fs = builtCatalogs(names, toolIds);
  if (setup.settingsOnDisk !== undefined) fs.setFile(SETTINGS_ABSOLUTE, setup.settingsOnDisk);
  const manifest = projectManifestOf(setup, toolIds);
  const manifestRepo = new SaveCountingManifestRepository(manifest);
  const registry = await registeredMarketplaces(names, setup.marketplaceScope ?? "project");
  const activator = setup.activator ?? new FakeHostActions({ available: true });
  const machineRepo = machineRepoOf(setup.existingMachineRegistrations);
  const useCase = marketplaceSync({
    tools: registeredTools(),
    fs,
    manifestRepo,
    marketplaceRegistry: registry,
    logger: new CapturingLogger(),
    activators: new Map(toolIds.map((toolId) => [toolId, activator])),
    ensureBuilt: buildPerMarketplace(setup.failingBuilds ?? []),
    hostMarketplaceRegistries: hostMarketplaceRegistriesOf(setup.hostRegisteredSource),
    hostPluginRegistries: new Map([
      [
        TOOL.claude,
        new FakeHostPluginRegistry({
          location: "/home/.claude/plugins/installed_plugins.json",
          refs: new Map(),
        }),
      ],
    ]),
    userManifestRepo: machineRepo,
    nativeSources: nativeSourcesOf(activator, names, setup.hostRegisteredSource),
  });
  return { useCase, manifestRepo, manifest, fs, activator, machineRepo };
}

export function recorded(manifest: Manifest | null | undefined): NativeRegistrations | undefined {
  return manifest?.getNativeRegistrations(TOOL.claude);
}

export function trackedSettingsHash(manifest: Manifest): string | undefined {
  return manifest.getToolFiles(TOOL.claude).find((file) => file.relativePath === SETTINGS_PATH)
    ?.hash.value;
}

export const FRAMEWORK_ONLY: RegistrationRecord = {
  binary: "claude",
  marketplaces: [
    {
      alias: MARKETPLACE,
      hostName: MARKETPLACE,
      provenance: { kind: "registry", source: `/built/${MARKETPLACE}/claude` },
    },
  ],
  pluginRefs: [],
};

export function ownedMachineEntry(
  alias: string,
  hostName: string,
  source?: string
): NativeRegistrations {
  return {
    binary: "claude",
    marketplaces: [
      {
        alias,
        hostName,
        ...(source === undefined ? {} : { provenance: { kind: "registry" as const, source } }),
      },
    ],
    pluginRefs: [],
    pluginClaims: [],
  };
}
