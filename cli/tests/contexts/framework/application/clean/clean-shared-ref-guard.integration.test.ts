/** At a host that enables a plugin machine-wide (no `NativeActivation.scopeArgs` — codex,
 * copilot), a ref is left enabled while another project still references its shared source. */
import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { describe, expect, it } from "vitest";
import {
  FRAMEWORK_MARKETPLACE_NAME,
  Marketplace,
} from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { CleanUseCase } from "../../../../../src/contexts/framework/application/clean-use-case.js";
import { GitignoreUseCase } from "../../../../../src/contexts/framework/application/gitignore-use-case.js";
import type { NativeMarketplaceRegistration } from "../../../../../src/contexts/framework/domain/manifest/native-registrations.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { UserSourceReferencesAdapter } from "../../../../../src/contexts/framework/infrastructure/user-source-references-adapter.js";
import type { NativeMarketplaceSourceReader } from "../../../../../src/contexts/tools/domain/ports/native-marketplace-source-reader.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const PROJECT_ROOT = "/test-project";
const OTHER_PROJECT = "/other-project";
const USER_CONFIG_DIR = "/fake-home/.config/aidd";
const OTHER_PROJECT_BYTES = "B still uses these bytes";

function provenRegistration(
  toolId: "codex" | "claude",
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
function currentHostSource(toolId: "codex" | "claude"): NativeMarketplaceSourceReader {
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

function seedManifest(
  toolId: "codex" | "claude",
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

function seedSharedMarketplaceRegistry(
  withOtherProjectCatalogue = false
): InMemoryMarketplaceRegistry {
  const registry = new InMemoryMarketplaceRegistry();
  registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: FRAMEWORK_MARKETPLACE_NAME,
      source: { kind: "local", path: "/some/built/path" },
      scope: "user",
      addedAt: "2026-01-01T00:00:00.000Z",
    })
  );
  if (withOtherProjectCatalogue) {
    registry.save(
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

function seedReferences(fs: InMemoryFileAdapter, roots: readonly string[]): void {
  fs.setFile(
    `${USER_CONFIG_DIR}/references.json`,
    JSON.stringify({ "1.0.0": [PROJECT_ROOT, ...roots] })
  );
  // `listAllReferencingProjects` filters by `fs.fileExists(root)`, so every root seeded here
  // needs a marker of its own or it reads back as no project at all.
  fs.setFile(`${PROJECT_ROOT}/marker`, "");
  for (const root of roots) fs.setFile(`${root}/marker`, OTHER_PROJECT_BYTES);
}

function buildUseCase(deps: {
  fs: InMemoryFileAdapter;
  manifest: Manifest;
  activator: FakeNativePluginActivator;
  binary: "codex" | "claude";
  logger: CapturingLogger;
  aiddMarketplaceRegistry: InMemoryMarketplaceRegistry;
  userManifestRepo?: InMemoryManifestRepository;
  gitignore?: GitignoreUseCase;
}): CleanUseCase {
  const manifestRepo = new InMemoryManifestRepository(deps.manifest, PROJECT_ROOT);
  const userSourceReferences = new UserSourceReferencesAdapter(deps.fs, () => USER_CONFIG_DIR);
  return new CleanUseCase(
    deps.fs,
    manifestRepo,
    deps.logger,
    deps.gitignore ?? new GitignoreUseCase(deps.fs),
    new Map([[deps.binary, deps.activator]]),
    deps.aiddMarketplaceRegistry,
    undefined,
    new Map(),
    () => "/fake-home",
    userSourceReferences,
    new Map([
      [
        deps.binary,
        new FakeHostPluginRegistryReader({
          location: "fixture host installed-plugin registry",
          refs: new Map([
            ["aidd-vcs@aidd-framework", { enabled: true }],
            ["plugin-b@other-mkt", { enabled: true }],
          ]),
        }),
      ],
    ]),
    deps.userManifestRepo,
    new Map([[deps.binary, currentHostSource(deps.binary)]])
  );
}

describe("clean guards a ref another project on this machine still needs", () => {
  it.each(["succeeds", "fails"] as const)(
    "releases A's native and user-plugin claims only when local cleanup %s",
    async (outcome) => {
      const fs = new InMemoryFileAdapter();
      seedReferences(fs, [OTHER_PROJECT]);
      const ref = "aidd-vcs@aidd-framework";
      const otherRef = "plugin-b@other-mkt";
      const registration = provenRegistration("codex", "aidd-framework", "aidd-framework");
      const project = seedManifest("codex", [registration], [ref]);
      project.addTool("cursor", "1.0.0", []);
      const record = (name: string, scope: "project" | "user" = "user") =>
        InstalledPlugin.fromJSON({
          name,
          source: { kind: "local", path: "/shared/plugins" },
          version: "1.0.0",
          strict: false,
          scope,
          files: {},
          dependents: [PROJECT_ROOT, OTHER_PROJECT],
        });
      project.addPlugin("cursor", record("shared").withDependents([]));
      project.addPlugin("cursor", record("local-only", "project").withDependents([]));
      const machine = Manifest.create();
      machine.addTool("codex", "1.0.0", []);
      machine.setNativeRegistrations("codex", {
        binary: "codex",
        marketplaces: [registration, provenRegistration("codex", "other-mkt", "other-mkt")],
        pluginRefs: [ref, otherRef],
        pluginClaims: [ref, otherRef].map((ref) => ({
          ref,
          dependents: [PROJECT_ROOT, OTHER_PROJECT],
        })),
      });
      machine.addTool("cursor", "1.0.0", []);
      for (const name of ["shared", "local-only", "unrelated"])
        machine.addPlugin("cursor", record(name));
      const machineRepo = new InMemoryManifestRepository(machine);
      const gitignore = new GitignoreUseCase(fs);
      if (outcome === "fails")
        gitignore.remove = async () => {
          throw new Error("gitignore cleanup failed");
        };
      fs.setFile(`${OTHER_PROJECT}/plugin-content.md`, OTHER_PROJECT_BYTES);
      const sharedPath = "/fake-home/.cursor/plugins/local/shared/skills/demo.md";
      fs.setFile(sharedPath, "shared plugin bytes");
      const activator = new FakeNativePluginActivator({ available: true });
      const useCase = buildUseCase({
        fs,
        manifest: project,
        activator,
        binary: "codex",
        logger: new CapturingLogger(),
        aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
        userManifestRepo: machineRepo,
        gitignore,
      });

      if (outcome === "fails")
        await expect(useCase.execute({ projectRoot: PROJECT_ROOT, force: true })).rejects.toThrow(
          "gitignore cleanup failed"
        );
      else await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

      const dependents = outcome === "succeeds" ? [OTHER_PROJECT] : [PROJECT_ROOT, OTHER_PROJECT];
      expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
        { ref, dependents },
        { ref: otherRef, dependents: [PROJECT_ROOT, OTHER_PROJECT] },
      ]);
      expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([
        ref,
        otherRef,
      ]);
      expect(
        machineRepo
          .getCurrent()
          ?.getPlugins("cursor")
          .map((plugin) => ({
            name: plugin.name,
            dependents: plugin.dependents,
          }))
      ).toEqual([
        { name: "shared", dependents },
        { name: "local-only", dependents: [PROJECT_ROOT, OTHER_PROJECT] },
        { name: "unrelated", dependents: [PROJECT_ROOT, OTHER_PROJECT] },
      ]);
      expect(
        await new UserSourceReferencesAdapter(
          fs,
          () => USER_CONFIG_DIR
        ).listAllReferencingProjects()
      ).toEqual(dependents);
      expect(fs.getFile(`${OTHER_PROJECT}/plugin-content.md`)).toBe(OTHER_PROJECT_BYTES);
      expect(fs.getFile(sharedPath)).toBe("shared plugin bytes");
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
    }
  );

  it("keeps codex's ref enabled and names the other project still referencing the shared source", async () => {
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    seedReferences(fs, [OTHER_PROJECT]);
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();

    const useCase = buildUseCase({
      fs,
      manifest: seedManifest(
        "codex",
        [provenRegistration("codex", "aidd-framework", "aidd-framework")],
        ["aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: "codex",
      logger,
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(activator.uninstalledPlugins).not.toContain("aidd-vcs@aidd-framework");
    expect(fs.getFile(`${USER_CONFIG_DIR}/references.json`)).toContain(OTHER_PROJECT);
    expect(fs.getFile(`${OTHER_PROJECT}/marker`)).toBe(OTHER_PROJECT_BYTES);
    expect(
      logger.warnMessages.some((m) => m.includes("left enabled") && m.includes(OTHER_PROJECT))
    ).toBe(true);
  });

  it("leaves an unclaimed machine-global Codex ref enabled after the last local reference", async () => {
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    seedReferences(fs, []);
    const activator = new FakeNativePluginActivator({ available: true });

    const useCase = buildUseCase({
      fs,
      manifest: seedManifest(
        "codex",
        [provenRegistration("codex", "aidd-framework", "aidd-framework")],
        ["aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: "codex",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(
      await new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR).listAllReferencingProjects()
    ).not.toContain(PROJECT_ROOT);
  });

  it("still disables claude's ref even with another project referencing the shared source", async () => {
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    seedReferences(fs, [OTHER_PROJECT]);
    const activator = new FakeNativePluginActivator({ available: true });

    const useCase = buildUseCase({
      fs,
      manifest: seedManifest(
        "claude",
        [provenRegistration("claude", "aidd-framework", "aidd-framework")],
        ["aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: "claude",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(activator.uninstalledPlugins).toContain("aidd-vcs@aidd-framework");
    expect(fs.getFile(`${OTHER_PROJECT}/marker`)).toBe(OTHER_PROJECT_BYTES);
  });

  it("leaves both unclaimed Codex refs enabled despite a distinct project catalogue", async () => {
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    seedReferences(fs, [OTHER_PROJECT]);
    const activator = new FakeNativePluginActivator({ available: true });

    const useCase = buildUseCase({
      fs,
      manifest: seedManifest(
        "codex",
        [
          provenRegistration("codex", "aidd-framework", "aidd-framework"),
          provenRegistration("codex", "other-mkt", "other-mkt"),
        ],
        ["aidd-vcs@aidd-framework", "plugin-b@other-mkt"]
      ),
      activator,
      binary: "codex",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(true),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.getFile(`${USER_CONFIG_DIR}/references.json`)).toContain(OTHER_PROJECT);
    expect(fs.getFile(`${OTHER_PROJECT}/marker`)).toBe(OTHER_PROJECT_BYTES);
  });

  it("leaves both unclaimed Codex refs enabled when the project catalogue is listed first", async () => {
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    seedReferences(fs, [OTHER_PROJECT]);
    const activator = new FakeNativePluginActivator({ available: true });

    const useCase = buildUseCase({
      fs,
      manifest: seedManifest(
        "codex",
        [
          provenRegistration("codex", "other-mkt", "other-mkt"),
          provenRegistration("codex", "aidd-framework", "aidd-framework"),
        ],
        ["plugin-b@other-mkt", "aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: "codex",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(true),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.getFile(`${USER_CONFIG_DIR}/references.json`)).toContain(OTHER_PROJECT);
    expect(fs.getFile(`${OTHER_PROJECT}/marker`)).toBe(OTHER_PROJECT_BYTES);
  });

  it("leaves an unclaimed global Codex ref enabled even without a recorded project reference", async () => {
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    // No references.json at all: no claim of this project's own to drop, and nothing else
    // referencing the source to guard on either.
    const activator = new FakeNativePluginActivator({ available: true });

    const useCase = buildUseCase({
      fs,
      manifest: seedManifest(
        "codex",
        [provenRegistration("codex", "aidd-framework", "aidd-framework")],
        ["aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: "codex",
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
  });

  // "This project's own claim was never recorded" and "no other project references it" are
  // different facts: only `OTHER_PROJECT` is named here, and its live claim still guards.
  it("keeps codex's ref enabled when this project's own claim was never recorded but another project's still is", async () => {
    const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
    fs.setFile(`${USER_CONFIG_DIR}/references.json`, JSON.stringify({ "1.0.0": [OTHER_PROJECT] }));
    fs.setFile(`${OTHER_PROJECT}/marker`, OTHER_PROJECT_BYTES);
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();

    const useCase = buildUseCase({
      fs,
      manifest: seedManifest(
        "codex",
        [provenRegistration("codex", "aidd-framework", "aidd-framework")],
        ["aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: "codex",
      logger,
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT, force: true });

    expect(activator.uninstalledPlugins).not.toContain("aidd-vcs@aidd-framework");
    expect(fs.getFile(`${USER_CONFIG_DIR}/references.json`)).toContain(OTHER_PROJECT);
    expect(fs.getFile(`${OTHER_PROJECT}/marker`)).toBe(OTHER_PROJECT_BYTES);
    expect(
      logger.warnMessages.some((m) => m.includes("left enabled") && m.includes(OTHER_PROJECT))
    ).toBe(true);
  });
});
