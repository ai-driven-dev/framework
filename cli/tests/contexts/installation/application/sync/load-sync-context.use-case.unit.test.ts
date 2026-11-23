import { describe, expect, it, vi } from "vitest";
import {
  LoadSyncContext,
  type LoadSyncContextRequest,
} from "../../../../../src/contexts/installation/application/sync/load-sync-context.use-case.js";
import type { ToolRecords } from "../../../../../src/contexts/installation/contract/records/scope-records.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import type { DeclaredMarketplace } from "../../../../../src/contexts/installation/ports/marketplace-sources.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const PROJECT = "/proj";
const FRAMEWORK = "aidd-framework";

const projectMarketplace = (name: string): DeclaredMarketplace => ({
  name,
  source: { kind: "local", path: `/src/${name}` },
  scope: "project",
});

const userMarketplace = (name: string): DeclaredMarketplace => ({
  ...projectMarketplace(name),
  scope: "user",
});

function manifestWith(...toolIds: (typeof TOOL)[keyof typeof TOOL][]): Manifest {
  const manifest = Manifest.create();
  for (const toolId of toolIds) manifest.addTool(toolId, "1.0.0", []);
  return manifest;
}

function setup(
  options: {
    project?: Manifest | null;
    user?: Manifest | null;
    userRecords?: ToolRecords;
    marketplaces?: readonly DeclaredMarketplace[];
    register?: boolean;
  } = {}
) {
  const registry = new FakeMarketplaceRegistry();
  for (const m of options.marketplaces ?? [projectMarketplace("m1")]) registry.seed(PROJECT, m);
  const project = new InMemoryManifestRepository(
    options.project === undefined ? manifestWith(TOOL.claude, TOOL.cursor) : options.project,
    PROJECT
  );
  const user =
    options.user === undefined
      ? undefined
      : new InMemoryManifestRepository(options.user, PROJECT, options.userRecords);
  const register = vi.fn(async ({ pluginSource }: { pluginSource?: unknown }) => {
    registry.seed(PROJECT, { ...userMarketplace(FRAMEWORK), source: { kind: "local", path: "." } });
    return pluginSource;
  });
  const load = new LoadSyncContext({
    project: { manifestRepo: project, records: project },
    user: user && { manifestRepo: user, records: user },
    marketplaceRegistry: registry,
    frameworkMarketplaceName: FRAMEWORK,
    marketplaceRegisterFrameworkUseCase: options.register ? { execute: register } : undefined,
  });
  return { load, project, user, register, registry };
}

const request = (overrides: Partial<LoadSyncContextRequest> = {}): LoadSyncContextRequest => ({
  projectRoot: PROJECT,
  scope: "project",
  ...overrides,
});

describe("loading the context of a sync", () => {
  it("answers null when no manifest is saved", async () => {
    expect(await setup({ project: null }).load.execute(request())).toBeNull();
  });

  it("answers null when no marketplace is registered", async () => {
    expect(await setup({ marketplaces: [] }).load.execute(request())).toBeNull();
  });

  it("loads the manifest, every marketplace and every installed tool", async () => {
    const { load, project } = setup();

    const context = await load.execute(request());

    expect(context?.manifest).toBe(await project.load());
    expect(context?.marketplaces.map((m) => m.name)).toStrictEqual(["m1"]);
    expect(context?.toolIds).toStrictEqual([TOOL.claude, TOOL.cursor]);
  });

  it("keeps only the requested tools that are installed", async () => {
    const { load } = setup();

    const context = await load.execute(request({ toolIds: [TOOL.cursor, TOOL.codex] }));

    expect(context?.toolIds).toStrictEqual([TOOL.cursor]);
  });

  it("keeps only the named marketplaces, and answers null when none match", async () => {
    const { load } = setup({ marketplaces: [projectMarketplace("m1"), projectMarketplace("m2")] });

    const context = await load.execute(request({ marketplaceNames: ["m2"] }));

    expect(context?.marketplaces.map((m) => m.name)).toStrictEqual(["m2"]);
    expect(await load.execute(request({ marketplaceNames: ["nope"] }))).toBeNull();
  });

  it("reads and saves the machine manifest for a user-scope run", async () => {
    const { load, project, user } = setup({ user: manifestWith(TOOL.codex) });

    const context = await load.execute(request({ scope: "user" }));
    context?.manifest.addTool(TOOL.opencode, "1.0.0", []);
    await context?.save();

    expect(context?.toolIds).toStrictEqual([TOOL.codex]);
    expect((await user?.load())?.getInstalledToolIds()).toContain(TOOL.opencode);
    expect((await project.load())?.getInstalledToolIds()).not.toContain(TOOL.opencode);
  });

  it("falls back to the project manifest for a user-scope run with no machine one kept", async () => {
    const { load } = setup();

    const context = await load.execute(request({ scope: "user" }));

    expect(context?.toolIds).toStrictEqual([TOOL.claude, TOOL.cursor]);
  });

  it("saves a project-scope run to the project manifest", async () => {
    const { load, project } = setup({ user: manifestWith() });

    const context = await load.execute(request());
    context?.manifest.addTool(TOOL.codex, "1.0.0", []);
    await context?.save();

    expect((await project.load())?.getInstalledToolIds()).toContain(TOOL.codex);
  });

  it("treats an unreadable manifest as none", async () => {
    const { load, project } = setup();
    vi.spyOn(project, "load").mockRejectedValue(new Error("corrupt"));

    expect(await load.execute(request())).toBeNull();
  });

  describe("recreating the framework", () => {
    it("registers it when no marketplace is left, then loads the new one", async () => {
      const { load, register } = setup({ marketplaces: [], register: true });

      const context = await load.execute(request({ recreateFrameworkIfMissing: true }));

      expect(register).toHaveBeenCalledWith({ projectRoot: PROJECT, pluginSource: undefined });
      expect(context?.marketplaces.map((m) => m.name)).toStrictEqual([FRAMEWORK]);
    });

    it("retires a project-scope framework entry, carrying its source forward", async () => {
      const framework = projectMarketplace(FRAMEWORK);
      const { load, register } = setup({ marketplaces: [framework], register: true });

      await load.execute(request({ recreateFrameworkIfMissing: true }));

      expect(register).toHaveBeenCalledWith({
        projectRoot: PROJECT,
        pluginSource: framework.source,
      });
    });

    it("leaves a registry alone when the framework is not a project entry", async () => {
      const { load, register } = setup({
        marketplaces: [projectMarketplace("m1")],
        register: true,
      });

      await load.execute(request({ recreateFrameworkIfMissing: true }));

      expect(register).not.toHaveBeenCalled();
    });

    it("registers nothing unless asked to recreate", async () => {
      const { load, register } = setup({ marketplaces: [], register: true });

      expect(await load.execute(request())).toBeNull();
      expect(register).not.toHaveBeenCalled();
    });

    it("keeps the silent no-op when no registrar is wired", async () => {
      const { load } = setup({ marketplaces: [] });

      expect(await load.execute(request({ recreateFrameworkIfMissing: true }))).toBeNull();
    });
  });
});
