import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { NativeMarketplaceRegistration } from "../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { CleanProject } from "../../../src/orchestration/clean/clean-project.use-case.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import type { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import type { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import type { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";
import { projectCleaner } from "./project-cleaner.builder.js";

export const PROJECT_ROOT = "/test-project";
export const OTHER_PROJECT = "/other-project";
export const USER_CONFIG_DIR = "/fake-home/.config/aidd";
export const OTHER_PROJECT_BYTES = "B still uses these bytes";

export function provenRegistration(
  toolId: AiToolId,
  alias: string,
  hostName: string
): NativeMarketplaceRegistration {
  const source = hostName === "other-mkt" ? "/other/built/path" : "/some/built/path";
  return {
    alias,
    hostName,
    provenance:
      toolId === "claude"
        ? { kind: "registry", source }
        : { kind: "effective-list", root: source, sourceType: "local", source },
  };
}

/** A separate, literal host snapshot: not assembled from the machine claim. */
function currentHostSource(toolId: AiToolId): HostMarketplaceSources {
  return {
    read: async () => ({
      location: "fixture native host",
      entries: new Map([
        [
          "aidd-framework",
          toolId === "claude"
            ? { kind: "registry" as const, source: "/some/built/path" }
            : {
                kind: "effective-list" as const,
                root: "/some/built/path",
                sourceType: "local",
                source: "/some/built/path",
              },
        ],
        [
          "other-mkt",
          {
            kind: "effective-list" as const,
            root: "/other/built/path",
            sourceType: "local",
            source: "/other/built/path",
          },
        ],
      ]),
    }),
  };
}

export function seedManifest(
  toolId: AiToolId,
  marketplaces: readonly NativeMarketplaceRegistration[],
  pluginRefs: readonly string[]
): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(toolId, "1.0.0", []);
  manifest.setNativeRegistrations(toolId, {
    binary: toolId,
    marketplaces: [...marketplaces],
    pluginRefs: [...pluginRefs],
  });
  return manifest;
}

export function seedSharedMarketplaceRegistry(
  withOtherProjectCatalogue = false
): InMemoryMarketplaceRegistry {
  const registry = new InMemoryMarketplaceRegistry();
  registry.seed(
    PROJECT_ROOT,
    Marketplace.create({
      name: FRAMEWORK_MARKETPLACE_NAME,
      source: { kind: "local", path: "/some/built/path" },
      scope: "user",
      addedAt: "2026-01-01T00:00:00.000Z",
    })
  );
  if (withOtherProjectCatalogue) {
    registry.seed(
      PROJECT_ROOT,
      Marketplace.create({
        name: "other-mkt",
        source: { kind: "local", path: "/other/built/path" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00.000Z",
      })
    );
  }
  return registry;
}

export function seedReferences(fs: InMemoryFileAdapter, roots: readonly string[]): void {
  fs.setFile(
    `${USER_CONFIG_DIR}/references.json`,
    JSON.stringify({ "1.0.0": [PROJECT_ROOT, ...roots] })
  );
  // `listAllReferencingProjects` filters by `fs.fileExists(root)`, so every root seeded here
  // needs a marker of its own or it reads back as no project at all.
  fs.setFile(`${PROJECT_ROOT}/marker`, "");
  for (const root of roots) fs.setFile(`${root}/marker`, OTHER_PROJECT_BYTES);
}

export function buildUseCase(deps: {
  fs: InMemoryFileAdapter;
  manifest: Manifest;
  activator: FakeHostActions;
  binary: AiToolId;
  logger: CapturingLogger;
  aiddMarketplaceRegistry: InMemoryMarketplaceRegistry;
  userManifestRepo?: InMemoryManifestRepository;
  gitignore?: UpdateGitignore;
}): CleanProject {
  const manifestRepo = new InMemoryManifestRepository(deps.manifest, PROJECT_ROOT);
  const userSourceReferences = new UserSourceReferencesAdapter(deps.fs, () => USER_CONFIG_DIR);
  return projectCleaner({
    fs: deps.fs,
    manifestRepo,
    logger: deps.logger,
    gitignore: deps.gitignore ?? new UpdateGitignore(deps.fs),
    activators: new Map([[deps.binary, deps.activator]]),
    marketplaceRegistry: deps.aiddMarketplaceRegistry,
    homeDir: () => "/fake-home",
    userSourceReferences,
    pluginRegistries: new Map([
      [
        deps.binary,
        new FakeHostPluginRegistry({
          location: "fixture host installed-plugin registry",
          refs: new Map([
            ["aidd-vcs@aidd-framework", { enabled: true }],
            ["plugin-b@other-mkt", { enabled: true }],
          ]),
        }),
      ],
    ]),
    userManifestRepo: deps.userManifestRepo,
    sources: new Map([[deps.binary, currentHostSource(deps.binary)]]),
  });
}
