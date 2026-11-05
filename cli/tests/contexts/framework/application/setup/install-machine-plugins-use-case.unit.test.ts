import { describe, expect, it, vi } from "vitest";
import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import type { PluginCatalogEntry } from "../../../../../src/contexts/distribution/domain/catalog.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import type { PlannedUserPluginFileUpdate } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { InstallMachinePluginsUseCase } from "../../../../../src/contexts/framework/application/setup/install-machine-plugins-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import type { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { PluginInstallMode } from "../../../../../src/contexts/framework/domain/setup-flow.js";
import { FileHash, InstallationFile } from "../../../../../src/kernel/file.js";
import type { AiToolId } from "../../../../../src/kernel/tool.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";

const FRAMEWORK = Marketplace.create({
  name: "aidd-framework",
  source: { kind: "local", path: "/fw" },
  scope: "user",
  addedAt: "2026-01-01T00:00:00Z",
});

const CATALOG: PluginCatalogEntry[] = [
  {
    name: "aidd-dev",
    source: { kind: "local", path: "./plugins/aidd-dev" },
    recommended: true,
    strict: true,
  },
  {
    name: "aidd-pm",
    source: { kind: "local", path: "./plugins/aidd-pm" },
    recommended: false,
    strict: true,
  },
];

const HASH = "0".repeat(32);

function setup(marketplaces: Marketplace[] = [FRAMEWORK]) {
  const manifest = Manifest.create();
  manifest.addTool("opencode", "1.0.0", []);
  manifest.addTool("claude", "1.0.0", []);
  const planUpdate = vi.fn(
    async (plugin: InstalledPlugin, toolId: AiToolId): Promise<PlannedUserPluginFileUpdate> => {
      const relativePath = `agents/${plugin.name}-reviewer.md`;
      return {
        plugin,
        toolId,
        home: "/home",
        baseDir: "/home/.config/opencode",
        files: [new InstallationFile({ relativePath, content: "", hash: new FileHash(HASH) })],
        oldSafe: new Map(),
        next: plugin.withFiles(new Map([[relativePath, HASH]])),
      };
    }
  );
  const applyUpdate = vi.fn(async (plan: PlannedUserPluginFileUpdate) => plan.next);
  const useCase = new InstallMachinePluginsUseCase(
    { list: async () => marketplaces },
    {
      execute: async () => ({
        marketplace: FRAMEWORK,
        catalog: { plugins: CATALOG },
        localPath: "/fw",
      }),
    },
    { planUpdate, applyUpdate },
    new CapturingLogger()
  );
  return { manifest, useCase, planUpdate, applyUpdate };
}

function run(
  useCase: InstallMachinePluginsUseCase,
  manifest: Manifest,
  mode: PluginInstallMode,
  pluginNames: string[] = []
) {
  return useCase.execute(
    manifest,
    {
      projectRoot: "/project",
      toolIds: ["claude", "opencode"],
      mode,
      pluginNames,
    },
    async () => {}
  );
}

describe("InstallMachinePluginsUseCase", () => {
  it("records each chosen plugin's machine files for a tool that copies them, and names every one", async () => {
    const { manifest, useCase, planUpdate } = setup();

    const result = await run(useCase, manifest, "all");

    expect(result.plugins).toEqual(["aidd-dev", "aidd-pm"]);
    expect(
      manifest.getPlugins("opencode").map((p) => [p.name, p.scope, [...p.files.keys()]])
    ).toEqual([
      ["aidd-dev", "user", ["agents/aidd-dev-reviewer.md"]],
      ["aidd-pm", "user", ["agents/aidd-pm-reviewer.md"]],
    ]);
    expect(manifest.getPlugins("claude")).toEqual([]);
    expect(planUpdate).toHaveBeenCalledTimes(2);
  });

  it("also writes the plugins of a tool installing into a user plugins directory", async () => {
    const { manifest, useCase, planUpdate } = setup();
    manifest.addTool("cursor", "1.0.0", []);

    await useCase.execute(
      manifest,
      {
        projectRoot: "/project",
        toolIds: ["cursor"],
        mode: "recommended",
        pluginNames: [],
      },
      async () => {}
    );

    expect(manifest.getPlugins("cursor").map((p) => [p.name, p.scope])).toEqual([
      ["aidd-dev", "user"],
    ]);
    expect(planUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "aidd-dev" }),
      "cursor",
      "/project",
      expect.anything(),
      true
    );
  });

  it("writes nothing when a later plugin's plan is refused", async () => {
    const { manifest, useCase, planUpdate, applyUpdate } = setup();
    planUpdate.mockImplementationOnce(planUpdate.getMockImplementation()!);
    planUpdate.mockRejectedValueOnce(new Error("already exists"));

    await expect(run(useCase, manifest, "all")).rejects.toThrow("already exists");

    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it("has recorded the plugins already written when a later write fails", async () => {
    const { manifest, useCase, applyUpdate } = setup();
    applyUpdate.mockImplementationOnce(async (plan) => plan.next);
    applyUpdate.mockRejectedValueOnce(new Error("disk full"));
    const recorded: string[][] = [];

    await expect(
      useCase.execute(
        manifest,
        { projectRoot: "/project", toolIds: ["opencode"], mode: "all", pluginNames: [] },
        async (saved) => {
          recorded.push(saved.getPlugins("opencode").map((plugin) => plugin.name));
        }
      )
    ).rejects.toThrow("disk full");

    expect(recorded).toEqual([["aidd-dev"]]);
  });

  it("keeps the recommended plugins alone", async () => {
    const { manifest, useCase } = setup();

    expect((await run(useCase, manifest, "recommended")).plugins).toEqual(["aidd-dev"]);
  });

  it("refuses a named plugin the catalog does not carry", async () => {
    const { manifest, useCase } = setup();

    await expect(run(useCase, manifest, "named", ["aidd-nope"])).rejects.toThrow(
      "Not in the framework catalog: aidd-nope."
    );
  });

  it("installs nothing for --plugins none", async () => {
    const { manifest, useCase, planUpdate } = setup();

    expect((await run(useCase, manifest, "none")).plugins).toEqual([]);
    expect(planUpdate).not.toHaveBeenCalled();
  });

  it("refuses when no shared framework source is registered", async () => {
    const { manifest, useCase } = setup([]);

    await expect(run(useCase, manifest, "all")).rejects.toThrow("none is registered");
  });
});
