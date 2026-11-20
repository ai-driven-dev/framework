import { join } from "node:path";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";

export const USER_CONFIG_DIR = "/fake-home/.config/aidd";
export const HOME = "/fake-home";
export const CLAUDE_CACHE = join(HOME, ".claude", "plugins", "cache");
export const CODEX_CACHE = join(HOME, ".codex", "plugins", "cache");
export const WHITELIST_PURGE_MESSAGES = [
  `user scope: cache/built purged: ${join(USER_CONFIG_DIR, "cache", "built")}`,
  `user scope: cache/marketplaces/aidd-framework purged: ${join(USER_CONFIG_DIR, "cache", "marketplaces", FRAMEWORK_MARKETPLACE_NAME)}`,
  `user scope: cache/plugin-cache purged: ${join(USER_CONFIG_DIR, "cache", "plugin-cache")}`,
  `user scope: cache/marketplaces purged: ${join(USER_CONFIG_DIR, "cache", "marketplaces")}`,
  `user scope: cache/update-check.json purged: ${join(USER_CONFIG_DIR, "cache", "update-check.json")}`,
  `user scope: cache purged: ${join(USER_CONFIG_DIR, "cache")}`,
  `user scope: update-check.json purged: ${join(USER_CONFIG_DIR, "update-check.json")}`,
  `user scope: references.json purged: ${join(USER_CONFIG_DIR, "references.json")}`,
];

/** Creates every entry the user-scope whitelist names, so each purge has something to remove. */
export async function seedWhitelist(
  fs: InMemoryFileAdapter,
  root = USER_CONFIG_DIR
): Promise<void> {
  const cache = join(root, "cache");
  await fs.createDirectory(join(cache, "built"));
  await fs.createDirectory(join(cache, "marketplaces", FRAMEWORK_MARKETPLACE_NAME));
  await fs.createDirectory(join(cache, "plugin-cache"));
  fs.setFile(join(cache, "update-check.json"), "{}");
  fs.setFile(join(root, "update-check.json"), "{}");
  fs.setFile(join(root, "references.json"), "{}");
}

/** Records every delete in order, so an ordering constraint can be proved without reading
 * the use case's own private state. A shared array correlates with another recorder. */
export class RecordingFileAdapter extends InMemoryFileAdapter {
  readonly order: string[];

  constructor(order: string[] = [], directories: readonly string[] = []) {
    super({}, directories);
    this.order = order;
  }

  override async deleteDirectory(path: string): Promise<void> {
    this.order.push(`deleteDirectory:${path}`);
    return super.deleteDirectory(path);
  }

  override async deleteFile(path: string): Promise<void> {
    this.order.push(`deleteFile:${path}`);
    return super.deleteFile(path);
  }
}

/** Pushes into the same shared `order` log the file adapter above writes to, so "the host was
 * asked to forget this marketplace" and "its cache was deleted" sit on one timeline. */
export class RecordingActivator implements HostActions {
  readonly order: string[];
  readonly removedMarketplaces: string[] = [];
  readonly removedMarketplaceScopes: Scope[] = [];
  readonly uninstalledPlugins: string[] = [];
  readonly uninstalledPluginScopes: Scope[] = [];

  constructor(order: string[]) {
    this.order = order;
  }

  isAvailable(): boolean {
    return true;
  }
  addMarketplace(): void {}
  enablesPlugins(): boolean {
    return true;
  }
  removeMarketplace(name: string, scope: Scope): void {
    this.order.push(`removeMarketplace:${name}`);
    this.removedMarketplaces.push(name);
    this.removedMarketplaceScopes.push(scope);
  }
  registrationState(): "live" | "dead" | "unknown" {
    return "unknown";
  }
  upgradeMarketplaces(): void {}
  enablePlugin(): void {}
  updatePlugin(): void {}
  uninstallPlugin(pluginRef: string, scope: Scope = "project"): void {
    this.order.push(`uninstallPlugin:${pluginRef}`);
    this.uninstalledPlugins.push(pluginRef);
    this.uninstalledPluginScopes.push(scope);
  }
}

export class StrictListingFileAdapter extends InMemoryFileAdapter {
  constructor(private readonly deniedDir?: string) {
    super();
  }

  override async listDirectory(dirPath: string): Promise<string[]> {
    if (dirPath === this.deniedDir) {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    }
    if (!(await this.fileExists(dirPath))) {
      throw Object.assign(new Error(`ENOENT: no such directory, ${dirPath}`), { code: "ENOENT" });
    }
    return super.listDirectory(dirPath);
  }
}

export function manifestWithClaude(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  manifest.setNativeRegistrations(TOOL.claude, {
    binary: "claude",
    marketplaces: [
      {
        alias: "aidd-framework",
        hostName: "aidd-framework",
        provenance: { kind: "registry", source: "/built/claude" },
      },
    ],
    pluginRefs: ["aidd-context@aidd-framework"],
    pluginClaims: [{ ref: "aidd-context@aidd-framework", dependents: [] }],
  });
  return manifest;
}

export function provenClaudeSources(
  source = "/built/claude"
): ReadonlyMap<AiToolId, HostMarketplaceSources> {
  return new Map([
    [
      TOOL.claude,
      {
        read: async () => ({
          location: "known_marketplaces.json",
          entries: new Map([["aidd-framework", { kind: "registry" as const, source }]]),
        }),
      },
    ],
  ]);
}

export function provenHostPlugins(
  manifest: Manifest
): ReadonlyMap<AiToolId, FakeHostPluginRegistry> {
  const readers = new Map<AiToolId, FakeHostPluginRegistry>();
  for (const toolId of [TOOL.claude, TOOL.codex]) {
    const registrations = manifest.getNativeRegistrations(toolId);
    if (registrations === undefined) continue;
    readers.set(
      toolId,
      new FakeHostPluginRegistry({
        location: `${toolId} installed plugins`,
        refs: new Map(
          (registrations.pluginClaims ?? []).map(({ ref }) => [ref, { enabled: true }])
        ),
      })
    );
  }
  return readers;
}

/** Seeds the cache path claude's own profile declares with a marker file: an empty or absent
 * directory is silently skipped rather than purged. */
export function seedClaudeCache(fs: InMemoryFileAdapter, hostName = "aidd-framework"): string {
  const cachePath = join(HOME, ".claude", "plugins", "cache", hostName);
  fs.setFile(join(cachePath, "marker.json"), "{}");
  return cachePath;
}
