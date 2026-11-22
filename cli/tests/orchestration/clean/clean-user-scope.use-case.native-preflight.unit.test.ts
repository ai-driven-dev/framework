import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { saying } from "../../shared/testing/saying.builder.js";
import {
  manifestWithClaude,
  provenClaudeSources,
  provenHostPlugins,
  RecordingActivator,
  RecordingFileAdapter,
  seedWhitelist,
  USER_CONFIG_DIR,
} from "../testing/clean-user-scope.builder.js";
import { userScopeCleaner } from "../testing/user-scope-cleaner.builder.js";

const homedir = (): string => "/home/dev";

describe("clean --scope user: native preflight", () => {
  it("preflights every native source before uninstalling any other catalogue", async () => {
    const machine = manifestWithClaude(TOOL);
    machine.addTool(TOOL.codex, "1.0.0", []);
    machine.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces: [
        {
          alias: "foreign-alias",
          hostName: "foreign-name",
          provenance: { kind: "effective-list", root: "/old", sourceType: "local", source: "/old" },
        },
      ],
      pluginRefs: ["plugin@foreign-name"],
      pluginClaims: [{ ref: "plugin@foreign-name", dependents: [] }],
    });
    const claude = new RecordingActivator([]);
    const codex = new RecordingActivator([]);
    const repo = new InMemoryManifestRepository(machine);
    const fs = new RecordingFileAdapter();
    const claudeSource = provenClaudeSources(TOOL).get(TOOL.claude);
    if (claudeSource === undefined) throw new Error("fixture missing Claude source reader");
    const sources = new Map<AiToolId, HostMarketplaceSources>([
      [TOOL.claude, claudeSource],
      [
        TOOL.codex,
        {
          read: async () => ({
            location: "host",
            entries: new Map([
              [
                "foreign-name",
                {
                  kind: "effective-list",
                  root: "/foreign",
                  sourceType: "local",
                  source: "/foreign",
                },
              ],
            ]),
          }),
        },
      ],
    ]);
    const useCase = userScopeCleaner({
      tools: registeredTools(),
      fs,
      repo,
      activators: new Map([
        [TOOL.claude, claude],
        [TOOL.codex, codex],
      ]),
      sources,
      pluginRegistries: provenHostPlugins(TOOL, machine),
    });
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /current host source differs.*reconcile manually/
    );
    expect(claude.uninstalledPlugins).toEqual([]);
    expect(claude.removedMarketplaces).toEqual([]);
    expect(codex.uninstalledPlugins).toEqual([]);
    expect(codex.removedMarketplaces).toEqual([]);
    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)).toBeDefined();
  });
  it("refuses all native host mutations when a stale canonical source points at a foreign Codex catalogue", async () => {
    const machine = Manifest.create();
    machine.addTool(TOOL.codex, "1.0.0", []);
    machine.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces: [
        {
          alias: "alias",
          hostName: "foreign-name",
          provenance: { kind: "effective-list", root: "/old", sourceType: "local", source: "/old" },
        },
      ],
      pluginRefs: ["plugin@foreign-name"],
      pluginClaims: [{ ref: "plugin@foreign-name", dependents: [] }],
    });
    const repo = new InMemoryManifestRepository(machine);
    const fs = new RecordingFileAdapter();
    const activator = new RecordingActivator([]);
    const source: HostMarketplaceSources = {
      read: async () => ({
        location: "host",
        entries: new Map([
          [
            "foreign-name",
            { kind: "effective-list", root: "/foreign", sourceType: "local", source: "/foreign" },
          ],
        ]),
      }),
    };
    const useCase = userScopeCleaner({
      tools: registeredTools(),
      fs,
      repo,
      activators: new Map([[TOOL.codex, activator]]),
      sources: new Map([[TOOL.codex, source]]),
    });
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /current host source differs.*reconcile manually/
    );
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.marketplaces).toHaveLength(1);
  });
  it("refuses an active B native ref even with force, then succeeds only after B detaches", async () => {
    const machine = manifestWithClaude(TOOL);
    const registrations = machine.getNativeRegistrations(TOOL.claude);
    if (registrations === undefined) throw new Error("fixture missing native registration");
    machine.setNativeRegistrations(TOOL.claude, {
      ...registrations,
      pluginClaims: [{ ref: "aidd-context@aidd-framework", dependents: ["/B"] }],
    });
    const repo = new InMemoryManifestRepository(machine);
    const fs = new RecordingFileAdapter();
    const activator = new RecordingActivator([]);
    const useCase = userScopeCleaner({
      tools: registeredTools(),
      fs,
      repo,
      activators: new Map([[TOOL.claude, activator]]),
      marketplaceRegistries: new Map([
        [
          TOOL.claude,
          new FakeHostMarketplaceRegistry({
            location: "known_marketplaces.json",
            entries: new Map(),
          }),
        ],
      ]),
      sources: provenClaudeSources(TOOL),
      pluginRegistries: provenHostPlugins(TOOL, machine),
    });
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      saying(/active projects.*\/B/)
    );
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)?.pluginClaims).toEqual([
      { ref: "aidd-context@aidd-framework", dependents: ["/B"] },
    ]);
    machine.setNativeRegistrations(TOOL.claude, {
      ...registrations,
      pluginClaims: [{ ref: "aidd-context@aidd-framework", dependents: [] }],
    });
    await useCase.execute({ projectRoot: "/A", force: true });
    expect(activator.uninstalledPlugins).toEqual(["aidd-context@aidd-framework"]);
    expect(activator.removedMarketplaces).toEqual(["aidd-framework"]);
    expect(repo.getCurrent()).toBeNull();
  });

  it("refuses an active B Cursor user plugin but never treats project files as machine-owned", async () => {
    const userFile = join(homedir(), ".cursor", "plugins", "local", "shared", "skills", "x.md");
    const projectFile = "/A/skills/local.md";
    const fs = new RecordingFileAdapter();
    fs.setFile(userFile, "shared bytes");
    fs.setFile(projectFile, "project bytes");
    const machine = Manifest.create();
    machine.addTool(TOOL.cursor, "1.0.0", []);
    const shared = RecordedPlugin.fromMetadata({
      name: "shared",
      version: "1.0.0",
      source: { kind: "local", path: "/source" },
      strict: false,
      scope: "user",
    })
      .withFiles(new Map([["shared/skills/x.md", FileHash.of("shared bytes").value]]))
      .withMachineClaim(["/B"]);
    machine.addPlugin(TOOL.cursor, shared);
    machine.addPlugin(
      TOOL.cursor,
      RecordedPlugin.fromMetadata({
        name: "local",
        version: "1.0.0",
        source: { kind: "local", path: "/source" },
        strict: false,
        scope: "project",
      })
        .withFiles(new Map([["skills/local.md", "hash"]]))
        .withMachineClaim(["/project-foreign"])
    );
    const repo = new InMemoryManifestRepository(machine);
    const useCase = userScopeCleaner({ tools: registeredTools(), fs, repo, homeDir: homedir });

    expect(
      (await useCase.execute({ projectRoot: "/A", force: false })).preview.activePluginDependents
    ).toEqual(["/B"]);
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      saying(/\/B/)
    );
    expect(fs.has(userFile)).toBe(true);
    expect(fs.has(projectFile)).toBe(true);
    expect(
      repo
        .getCurrent()
        ?.getRecordedPlugins(TOOL.cursor)
        .find((plugin) => plugin.plugin.name === "shared")?.machineClaim
    ).toEqual(["/B"]);

    machine.updatePlugin(TOOL.cursor, shared.withMachineClaim(undefined));
    await useCase.execute({ projectRoot: "/A", force: true });
    expect(repo.getCurrent()).toBeNull();
    expect(fs.has(userFile)).toBe(false);
    expect(fs.order).toContain(`deleteFile:${userFile}`);
    expect(fs.has(projectFile)).toBe(true);
  });

  it("unregisters the framework marketplace after the last whitelisted file, before the manifest", async () => {
    const order: string[] = [];
    class RecordingRegistry extends InMemoryMarketplaceRegistry {
      override async delete(root: string, name: string, scope: Scope): Promise<void> {
        order.push(`unregister:${name}:${scope}`);
        return super.delete(root, name, scope);
      }
    }
    class RecordingRepository extends InMemoryManifestRepository {
      override async delete(): Promise<void> {
        order.push("deleteManifest");
        return super.delete();
      }
    }
    const fs = new RecordingFileAdapter(order);
    await seedWhitelist(fs);
    const useCase = userScopeCleaner({
      tools: registeredTools(),
      fs,
      repo: new RecordingRepository(Manifest.create()),
      marketplaceRegistry: new RecordingRegistry(),
    });

    await useCase.execute({ projectRoot: "/A", force: true });

    expect(order.slice(-3)).toEqual([
      `deleteFile:${join(USER_CONFIG_DIR, "references.json")}`,
      "unregister:aidd-framework:user",
      "deleteManifest",
    ]);
  });

  it("retains canonical claims if the user catalogue registry refuses the final delete", async () => {
    class RefusingRegistry extends InMemoryMarketplaceRegistry {
      override async delete(_root: string, _name: string, _scope: Scope): Promise<void> {
        throw new Error("registry delete failed");
      }
    }
    const repo = new InMemoryManifestRepository(Manifest.create());
    const useCase = userScopeCleaner({
      tools: registeredTools(),
      fs: new RecordingFileAdapter(),
      repo,
      marketplaceRegistry: new RefusingRegistry(),
    });
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /registry delete failed/
    );
    expect(repo.getCurrent()).not.toBeNull();
  });
});
