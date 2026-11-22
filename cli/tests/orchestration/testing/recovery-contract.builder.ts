import { resolve } from "node:path";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { NativePluginCliError } from "../../../src/contexts/host-registration/domain/host-registration.error.js";
import type { HostPluginRegistryReading } from "../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { HostMarketplaceRegistry } from "../../../src/contexts/host-registration/ports/host-marketplace-registry.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../src/shared/domain/installation-file.js";
import { builtMarketplaceDir } from "../../../src/shared/domain/layout/aidd-layout.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";

export const ROOT = "/project";
export const ALIAS = "team-tools";
export const HOST = "team-catalog";
export const BUILT = "/built/claude";
export const REF = `review@${HOST}`;
export const OLD = builtMarketplaceDir(ROOT, ALIAS, "claude");
export const ADD_ERROR = "catalogue already exists";
export const RECLAIM = `Marketplace '${HOST}' was registered to a directory that no longer exists; re-registering it for this project. Plugins installed from it are removed and the ones this CLI manages are put back.`;

/** What a sync reports when every tool ran and nothing went wrong, but for the tools named. */
export const CLEAN_RUN = { binaryMissing: [], warnings: [], errors: [], failed: false };

export class RecoveringActivator extends FakeHostActions {
  readonly adds: Array<{ source: string; scope: Scope | undefined }> = [];
  readonly removals: Array<{ name: string; scope: Scope | undefined; force: boolean }> = [];

  constructor(private readonly failure?: "remove" | "retry" | "crash") {
    super({ available: true, registrationState: "dead" });
  }

  override addMarketplace(source: string, scope?: Scope): void {
    this.adds.push({ source, scope });
    if (this.adds.length === 1) throw new NativePluginCliError(ADD_ERROR);
    if (this.failure === "retry") throw new NativePluginCliError("retry denied");
    if (this.failure === "crash") throw new Error("retry crashed");
    super.addMarketplace(source, scope);
  }

  override removeMarketplace(name: string, scope?: Scope, options?: { force?: boolean }): void {
    this.removals.push({ name, scope, force: options?.force === true });
    if (this.failure === "remove") throw new NativePluginCliError("remove denied");
    super.removeMarketplace(name, scope, options);
  }
}

export interface RecoveryOptions {
  tools: ToolCatalog;
  claude: AiToolId;
  source?: string;
  userRoot?: string;
  scope?: Scope;
  failure?: "remove" | "retry" | "crash";
  state?: "live" | "unknown";
  realpathFails?: readonly string[];
  host?: HostMarketplaceRegistry;
  plugins?: readonly HostPluginRegistryReading[];
  sourceAfterCollision?: "absent" | "foreign";
  settings?: string;
  ownRefs?: readonly string[];
}

class MissingDirectories extends InMemoryFileAdapter {
  constructor(
    files: Record<string, string>,
    private readonly missing: readonly string[] = []
  ) {
    super(files);
  }

  override async realpath(path: string): Promise<string> {
    if (this.missing.includes(path)) throw new Error(`ENOENT: ${path}`);
    return super.realpath(path);
  }
}

function ownedProject(options: RecoveryOptions) {
  const source = options.source ?? OLD;
  const settings = options.settings ?? "{}";
  const manifest = Manifest.create();
  manifest.addTool(options.claude, "1.0.0", [
    new InstallationFile({
      relativePath: ".claude/settings.json",
      content: settings,
      hash: FileHash.of(settings),
    }),
  ]);
  manifest.addPlugin(
    options.claude,
    RecordedPlugin.fromMetadata({
      name: "review",
      version: "1.0.0",
      source: { kind: "local", path: "/plugins/review" },
      strict: true,
      scope: "project",
      marketplace: ALIAS,
    })
  );
  manifest.setNativeRegistrations(options.claude, {
    binary: "claude",
    marketplaces: [{ alias: ALIAS, hostName: HOST, provenance: { kind: "registry", source } }],
    pluginRefs: options.ownRefs ?? [],
  });
  return manifest;
}

function recoveryFiles(options: RecoveryOptions) {
  const catalogue = {
    [`${BUILT}/.claude-plugin/marketplace.json`]: JSON.stringify({
      name: HOST,
      plugins: [{ name: "review" }],
    }),
  };
  if (options.settings === undefined) return catalogue;
  return { ...catalogue, [resolve(ROOT, ".claude/settings.json")]: options.settings };
}

function recoveryActivator(options: RecoveryOptions) {
  if (options.state === undefined) return new RecoveringActivator(options.failure);
  return new FakeHostActions({
    available: true,
    conflictOnAdd: true,
    registrationState: options.state,
  });
}

function collidedSources(sourceAfterCollision: "absent" | "foreign") {
  return {
    location: "host source after collision",
    entries:
      sourceAfterCollision === "absent"
        ? new Map()
        : new Map([[HOST, { kind: "registry" as const, source: "/foreign/source" }]]),
  };
}

function hostSourcesThroughRecovery(
  activator: FakeHostActions,
  delegate: FakeHostMarketplaceSources,
  sourceAfterCollision: RecoveryOptions["sourceAfterCollision"]
): HostMarketplaceSources {
  return {
    read: async (root) => {
      if (activator.removedMarketplaces.length > 0 && activator.addedMarketplaces.length === 0) {
        return { location: "host source after removal", entries: new Map() };
      }
      const collided =
        activator instanceof RecoveringActivator &&
        activator.adds.length > 0 &&
        activator.addedMarketplaces.length === 0;
      if (collided && sourceAfterCollision !== undefined) {
        return collidedSources(sourceAfterCollision);
      }
      return delegate.read(root);
    },
  };
}

function pluginsReadInTurn(readings: readonly HostPluginRegistryReading[]) {
  const queue = [...readings];
  return {
    read: async () => {
      const reading = queue[0];
      if (queue.length > 1) queue.shift();
      return reading;
    },
  };
}

export async function recovery(options: RecoveryOptions) {
  const source = options.source ?? OLD;
  const manifest = ownedProject(options);
  const repo = new InMemoryManifestRepository(manifest, ROOT);
  const registry = new InMemoryMarketplaceRegistry();
  await registry.save(
    ROOT,
    Marketplace.create({
      name: ALIAS,
      source: { kind: "local", path: "/source" },
      scope: options.scope ?? "project",
      addedAt: "2026-09-15T00:00:00Z",
    })
  );
  const fs = new MissingDirectories(recoveryFiles(options), options.realpathFails);
  const logger = new CapturingLogger();
  const activator = recoveryActivator(options);
  const delegate = new FakeHostMarketplaceSources(
    activator,
    "registry",
    () => HOST,
    new Map([[HOST, { kind: "registry", source }]])
  );
  const hostCatalogues: HostMarketplaceRegistry = options.host ?? {
    read: async () => ({ location: "host marketplaces", entries: new Map([[HOST, source]]) }),
  };
  const useCase = marketplaceSync({
    tools: options.tools,
    fs,
    manifestRepo: repo,
    marketplaceRegistry: registry,
    logger,
    activators: new Map([[options.claude, activator]]),
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    hostMarketplaceRegistries: new Map([[options.claude, hostCatalogues]]),
    userCacheRoot: () => options.userRoot ?? "",
    hostPluginRegistries: new Map([
      [
        options.claude,
        pluginsReadInTurn(options.plugins ?? [{ location: "host plugins", refs: new Map() }]),
      ],
    ]),
    nativeSources: new Map([
      [
        options.claude,
        hostSourcesThroughRecovery(activator, delegate, options.sourceAfterCollision),
      ],
    ]),
  });
  const result = await useCase.execute({ projectRoot: ROOT });
  return { activator, manifest, repo, logger, fs, result, useCase };
}
