import { join } from "node:path";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { CleanProject as ProductionCleanUseCase } from "../../../src/orchestration/clean/clean-project.js";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../src/shared/domain/installation-file.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";
import { type ProjectCleanerParts, projectCleanerDeps } from "./project-cleaner.builder.js";

export const PROJECT_ROOT = "/test-project";
export const AT_PROJECT = { tools: registeredTools(), projectRoot: PROJECT_ROOT } as const;
export const md5 = (content: string): string => FileHash.of(content).value;

/** Test-double host catalogues, deliberately seeded without consulting the manifest claim. */
export function nativeSourcesOnHost(): ReadonlyMap<AiToolId, HostMarketplaceSources> {
  const codexLike: HostMarketplaceSources = {
    read: async () => ({
      location: "fixture native host catalogue",
      entries: new Map(
        ["aidd-framework", "user-mkt", "other-host"].map((name) => [
          name,
          {
            kind: "effective-list" as const,
            root: "/some/built/path",
            sourceType: "local",
            source: "/some/built/path",
          },
        ])
      ),
    }),
  };
  const claude: HostMarketplaceSources = {
    read: async () => ({
      location: "fixture Claude host registry",
      entries: new Map([
        ["aidd-framework", { kind: "registry" as const, source: "/some/built/path" }],
      ]),
    }),
  };
  return new Map([
    [TOOL.codex, codexLike],
    [TOOL.copilot, codexLike],
    [TOOL.cursor, codexLike],
    [TOOL.claude, claude],
  ]);
}

/** Independently parsed test registry: no foreign refs unless a test seeds them explicitly. */
export function nativeRefsOnHost(): ReadonlyMap<AiToolId, HostPluginRegistry> {
  const empty = new FakeHostPluginRegistry({
    location: "fixture native plugin registry",
    refs: new Map(),
  });
  return new Map([
    [TOOL.codex, empty],
    [TOOL.copilot, empty],
    [TOOL.claude, empty],
    [TOOL.cursor, empty],
  ]);
}

/** The positional order a test names its collaborators in. */
export type TestCleanArgs = [
  fs: ProjectCleanerParts["fs"],
  manifestRepo: ProjectCleanerParts["manifestRepo"],
  logger: ProjectCleanerParts["logger"],
  gitignore: ProjectCleanerParts["gitignore"],
  activators?: ProjectCleanerParts["activators"],
  marketplaceRegistry?: ProjectCleanerParts["marketplaceRegistry"],
  prompter?: ProjectCleanerParts["prompter"],
  marketplaceRegistries?: ProjectCleanerParts["marketplaceRegistries"],
  homeDir?: ProjectCleanerParts["homeDir"],
  userSourceReferences?: ProjectCleanerParts["userSourceReferences"],
  pluginRegistries?: ProjectCleanerParts["pluginRegistries"],
  userManifestRepo?: ProjectCleanerParts["userManifestRepo"],
  sources?: ProjectCleanerParts["sources"],
];

export class CleanWithKnownHostSource extends ProductionCleanUseCase {
  constructor(...args: TestCleanArgs) {
    super(
      projectCleanerDeps({
        fs: args[0],
        manifestRepo: args[1],
        logger: args[2],
        gitignore: args[3],
        activators: args[4],
        marketplaceRegistry: args[5],
        prompter: args[6],
        marketplaceRegistries: args[7],
        homeDir: args[8],
        userSourceReferences: args[9],
        pluginRegistries: args[10]?.size ? args[10] : nativeRefsOnHost(),
        userManifestRepo: args[11],
        sources: args[12] ?? nativeSourcesOnHost(),
      })
    );
  }
}

/** Records every path `deleteFile` is called with, to prove where a plugin file got deleted. */
export class RecordingFileAdapter extends InMemoryFileAdapter {
  readonly deletedPaths: string[] = [];

  override async deleteFile(path: string): Promise<void> {
    this.deletedPaths.push(path);
    return super.deleteFile(path);
  }
}

// Cursor Mode B: the file key is base-relative, resolved against the user plugins dir.
export const PLUGIN_KEY = "aidd-context/commands/hello.md";

export const BINARY = "codex";
export const MARKETPLACE = "aidd-framework";
export const REF = "aidd-context@aidd-framework";

export function seedManifestWithNativeRegistrations(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.codex, "1.0.0", []);
  manifest.setNativeRegistrations(TOOL.codex, {
    binary: BINARY,
    marketplaces: [
      {
        alias: MARKETPLACE,
        hostName: MARKETPLACE,
        provenance: {
          kind: "effective-list",
          root: "/some/built/path",
          sourceType: "local",
          source: "/some/built/path",
        },
      },
    ],
    pluginRefs: [REF],
  });
  return manifest;
}

export function seedClaudeNativeRegistrations(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  manifest.setNativeRegistrations(TOOL.claude, {
    binary: "claude",
    marketplaces: [
      {
        alias: MARKETPLACE,
        hostName: MARKETPLACE,
        provenance: { kind: "registry", source: "/some/built/path" },
      },
    ],
    pluginRefs: [REF],
  });
  return manifest;
}

/** Explicit host ref evidence for Claude positives, separate from the AIDD manifest. */
export function claudeRefOnHost(scope?: Scope): ReadonlyMap<AiToolId, HostPluginRegistry> {
  return new Map([
    [
      TOOL.claude,
      new FakeHostPluginRegistry({
        location: "fixture Claude installed-plugin registry",
        refs: new Map([[REF, scope === undefined ? { enabled: true } : { enabled: true, scope }]]),
      }),
    ],
  ]);
}

export function seedMarketplaceRegistry(): InMemoryMarketplaceRegistry {
  const registry = new InMemoryMarketplaceRegistry();
  registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: MARKETPLACE,
      source: { kind: "local", path: "/some/built/path" },
      scope: "project",
      addedAt: "2026-01-01T00:00:00.000Z",
    })
  );
  return registry;
}

export const HASH = "abc123abc123abc123abc123abc123ab";

export function hash(): FileHash {
  return new FileHash(HASH);
}

export function fileEntry(relativePath: string): InstallationFile {
  return new InstallationFile({ relativePath, content: "", hash: hash() });
}

export function seedTrackedFiles(fs: InMemoryFileAdapter, paths: readonly string[]): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", paths.map(fileEntry));
  for (const path of paths) fs.setFile(join(PROJECT_ROOT, path), "x");
  return manifest;
}

export function previewOf(tools: ReadonlyArray<readonly [ToolId, number]>) {
  return {
    tools: tools.map(([toolId, fileCount]) => ({ toolId, fileCount })),
    totalFileCount: tools.reduce((sum, [, fileCount]) => sum + fileCount, 0),
    nativeRegistrations: [],
    sharedSourceOtherProjects: undefined,
  };
}

export class CrashingUninstallActivator implements HostActions {
  isAvailable(): boolean {
    return true;
  }
  addMarketplace(): void {}
  enablesPlugins(): boolean {
    return false;
  }
  removeMarketplace(): void {}
  registrationState(): "live" | "dead" | "unknown" {
    return "live";
  }
  upgradeMarketplaces(): void {}
  enablePlugin(): void {}
  updatePlugin(): void {}
  uninstallPlugin(): void {
    throw new Error("activator crashed uninstalling a plugin");
  }
}

/** Records `uninstallPlugin`/`removeMarketplace` calls in order, to assert which came first. */
export class OrderRecordingActivator implements HostActions {
  constructor(private readonly calls: string[]) {}
  isAvailable(): boolean {
    return true;
  }
  addMarketplace(): void {}
  enablesPlugins(): boolean {
    return false;
  }
  removeMarketplace(name: string): void {
    this.calls.push(`removeMarketplace:${name}`);
  }
  registrationState(): "live" | "dead" | "unknown" {
    return "live";
  }
  upgradeMarketplaces(): void {}
  enablePlugin(): void {}
  updatePlugin(): void {}
  uninstallPlugin(pluginRef: string): void {
    this.calls.push(`uninstall:${pluginRef}`);
  }
}

/** Runs `onRemoveMarketplace` at the exact moment `removeMarketplace` is called, so a test
 * can prove native undo happens before the built tree it depends on is deleted. */
export class AssertingActivator implements HostActions {
  constructor(private readonly onRemoveMarketplace: () => void | Promise<void>) {}
  isAvailable(): boolean {
    return true;
  }
  addMarketplace(): void {}
  enablesPlugins(): boolean {
    return false;
  }
  removeMarketplace(): void {
    void this.onRemoveMarketplace();
  }
  registrationState(): "live" | "dead" | "unknown" {
    return "live";
  }
  upgradeMarketplaces(): void {}
  enablePlugin(): void {}
  updatePlugin(): void {}
  uninstallPlugin(): void {}
}
