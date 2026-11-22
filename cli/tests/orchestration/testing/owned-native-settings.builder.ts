import { resolve } from "node:path";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { NativeMarketplaceSource } from "../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../src/shared/domain/installation-file.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";
import { ROOT } from "./recovery-contract.builder.js";

export interface OwnedNativeSettingsOptions {
  tools: ToolCatalog;
  toolId: AiToolId;
  withSettings?: boolean;
  names?: readonly string[];
  settings?: string;
  withPlugins?: boolean;
  cachedRoot?: string;
  cachedCatalogue?: string;
}

function registrationsOf(
  toolId: AiToolId,
  names: readonly string[],
  options: OwnedNativeSettingsOptions
) {
  const cachedName = options.cachedCatalogue ?? names[0];
  return names.map((name) => ({
    alias: `${name}-alias`,
    hostName: `${name}-catalog`,
    provenance: {
      kind: "effective-list" as const,
      root:
        name === cachedName
          ? (options.cachedRoot ?? `/built/${toolId}/${name}`)
          : `/built/${toolId}/${name}`,
      sourceType: "local",
      source: `/built/${toolId}/${name}`,
    },
  }));
}

function settingsFilesOf(settingsPath: string, withSettings: boolean, settings: string) {
  if (!withSettings) return [];
  return [
    new InstallationFile({
      relativePath: settingsPath,
      content: settings,
      hash: FileHash.of(settings),
    }),
  ];
}

function reviewPlugin(name: string, alias: string) {
  return RecordedPlugin.fromMetadata({
    name: `review-${name}`,
    version: "1.0.0",
    source: { kind: "local", path: `/sources/${name}/review` },
    strict: true,
    scope: "project",
    marketplace: alias,
  });
}

export async function ownedNativeSettings(options: OwnedNativeSettingsOptions) {
  const { toolId } = options;
  const settingsPath = `.${toolId}/settings.json`;
  const names = options.names ?? ["first"];
  const settings = options.settings ?? JSON.stringify({ permissions: { allow: ["Read"] } });
  const registrations = registrationsOf(toolId, names, options);
  const refs =
    options.withPlugins === false
      ? []
      : names.map((name, i) => `review-${name}@${registrations[i].hostName}`);
  const project = Manifest.create();
  project.addTool(
    toolId,
    "1.0.0",
    settingsFilesOf(settingsPath, options.withSettings !== false, settings)
  );
  const machine = Manifest.create();
  machine.addTool(toolId, "1.0.0", []);
  const projectRepo = new InMemoryManifestRepository(
    project,
    ROOT,
    new Map([[toolId, { binary: toolId, marketplaces: registrations, pluginRefs: refs }]])
  );
  const machineRepo = new InMemoryManifestRepository(
    machine,
    undefined,
    new Map([
      [
        toolId,
        {
          binary: toolId,
          marketplaces: registrations,
          pluginRefs: [],
          pluginClaims: refs.map((ref) => ({ ref, dependents: [ROOT] })),
        },
      ],
    ])
  );
  const registry = new InMemoryMarketplaceRegistry();
  const fs = new InMemoryFileAdapter({ [resolve(ROOT, settingsPath)]: settings });
  const identities = new Map<string, string>();
  const initial = new Map<string, NativeMarketplaceSource>();
  for (const [index, name] of names.entries()) {
    const registration = registrations[index];
    const builtDir = `/built/${toolId}/${name}`;
    identities.set(builtDir, registration.hostName);
    initial.set(registration.hostName, registration.provenance);
    fs.setFile(
      `${builtDir}/.plugin/marketplace.json`,
      JSON.stringify({ name: registration.hostName, plugins: [{ name: `review-${name}` }] })
    );
    await registry.save(
      ROOT,
      Marketplace.create({
        name: registration.alias,
        source: { kind: "local", path: `/sources/${name}` },
        scope: "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    if (options.withPlugins !== false)
      project.addPlugin(toolId, reviewPlugin(name, registration.alias));
  }
  const activator = new FakeHostActions({ available: true });
  const logger = new CapturingLogger();
  const sync = marketplaceSync({
    tools: options.tools,
    fs,
    manifestRepo: projectRepo,
    marketplaceRegistry: registry,
    logger,
    activators: new Map([[toolId, activator]]),
    ensureBuilt: {
      execute: async ({ marketplace }) => ({
        builtDir: `/built/${toolId}/${marketplace.name.replace(/-alias$/, "")}`,
        version: "1.0.0",
        rebuilt: false,
      }),
    },
    hostPluginRegistries: new Map([
      [
        toolId,
        {
          read: async () => ({
            location: "host plugins",
            refs: new Map(refs.map((ref) => [ref, { enabled: true }])),
          }),
        },
      ],
    ]),
    userManifestRepo: machineRepo,
    nativeSources: new Map([
      [
        toolId,
        new FakeHostMarketplaceSources(
          activator,
          "effective-list",
          (path) => identities.get(path),
          initial
        ),
      ],
    ]),
  });
  return {
    sync,
    fs,
    activator,
    logger,
    projectRepo,
    machineRepo,
    settingsPath,
    registrations,
    refs,
  };
}
