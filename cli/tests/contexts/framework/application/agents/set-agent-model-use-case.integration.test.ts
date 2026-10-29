import { describe, expect, it } from "vitest";
import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { SetAgentModelUseCase } from "../../../../../src/contexts/framework/application/agents/set-agent-model-use-case.js";
import type { MarketplaceSyncSettingsOptions } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import type { PluginUpdateOptions } from "../../../../../src/contexts/framework/application/plugin/plugin-update-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { AgentModelStoreAdapter } from "../../../../../src/contexts/framework/infrastructure/agent-model-store-adapter.js";
import { FaultingFileAdapter } from "../../../../helpers/ports/faulting-file-adapter.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";

const PROJECT = "/p";
const HOME = "/home/me";
const CONFIG = "/home/me/.config/aidd";

function plugin(scope: "project" | "user"): InstalledPlugin {
  return InstalledPlugin.fromJSON({
    name: "aidd-orchestrator",
    source: { kind: "local", path: "./orchestrator" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope,
  });
}

function setup(
  seed?: (manifest: Manifest) => void,
  userManifest: Manifest | null = null,
  fs: InMemoryFileAdapter = new InMemoryFileAdapter()
) {
  const manifest = Manifest.create();
  seed?.(manifest);
  const updates: PluginUpdateOptions[] = [];
  const userUpdates: PluginUpdateOptions[] = [];
  const activations: MarketplaceSyncSettingsOptions[] = [];
  const useCase = new SetAgentModelUseCase(
    fs,
    new AgentModelStoreAdapter(fs, () => CONFIG),
    new InMemoryManifestRepository(manifest, PROJECT),
    new InMemoryManifestRepository(userManifest, CONFIG),
    {
      execute: async (options) => {
        updates.push(options);
        return ["aidd-orchestrator"];
      },
    },
    {
      execute: async (options) => {
        userUpdates.push(options);
        return [];
      },
    },
    {
      execute: async (options) => {
        activations.push(options);
        return { activated: [], binaryMissing: [], warnings: [], errors: [] };
      },
    },
    () => HOME,
    () => undefined
  );
  return { fs, useCase, updates, userUpdates, activations };
}

describe("SetAgentModelUseCase", () => {
  it("records the provider machine-wide, and re-installs this project's plugins with it", async () => {
    const { fs, useCase, updates, activations } = setup((manifest) => {
      manifest.addTool("opencode", "1.0.0", []);
      manifest.addPlugin("opencode", plugin("project"));
    });

    const result = await useCase.execute({
      projectRoot: PROJECT,
      hosts: ["opencode"],
      provider: "mistral",
      scope: "project",
    });

    expect(fs.getFile(`${CONFIG}/agent-models.json`)).toBe('{\n  "opencode": "mistral"\n}\n');
    expect(updates).toStrictEqual([{ toolIds: ["opencode"], projectRoot: PROJECT, rebuild: true }]);
    expect(activations).toStrictEqual([{ projectRoot: PROJECT, toolIds: ["opencode"] }]);
    expect(result).toStrictEqual({ mainSet: [], reinstalled: ["aidd-orchestrator"] });
  });

  it("sets the main session on the smart model, and restores what it replaced once unset", async () => {
    const { fs, useCase } = setup();
    const settings = `${PROJECT}/.claude/settings.local.json`;
    fs.setFile(settings, '{\n  "model": "mine"\n}\n');

    await useCase.execute({
      projectRoot: PROJECT,
      hosts: ["claude"],
      provider: "anthropic",
      main: true,
      scope: "project",
    });
    expect(fs.getFile(settings)).toBe(
      '{\n  "model": "claude-opus-5-5",\n  "effortLevel": "high"\n}\n'
    );

    await useCase.execute({ projectRoot: PROJECT, hosts: ["claude"], scope: "project" });
    expect(fs.getFile(settings)).toBe('{\n  "model": "mine"\n}\n');
    expect(fs.has(`${PROJECT}/.aidd/main-model.json`)).toBe(false);
    expect(fs.has(`${CONFIG}/agent-models.json`)).toBe(false);
  });

  it("writes a global main model in the host's own user settings", async () => {
    const { fs, useCase } = setup();

    await useCase.execute({
      projectRoot: PROJECT,
      hosts: ["claude"],
      provider: "anthropic",
      main: true,
      scope: "user",
    });

    expect(fs.getFile(`${HOME}/.claude/settings.json`)).toBe(
      '{\n  "model": "claude-opus-5-5",\n  "effortLevel": "high"\n}\n'
    );
    expect(fs.has(`${CONFIG}/main-model.json`)).toBe(true);
  });

  it("records what a settings file held before writing it, so a failed run can still restore it", async () => {
    const fs = new FaultingFileAdapter();
    const { useCase } = setup(undefined, null, fs);
    fs.setFile(`${PROJECT}/.claude/settings.local.json`, '{\n  "model": "mine"\n}\n');
    fs.failOn("writeFile", `${PROJECT}/.claude/settings.local.json`, new Error("disk full"));

    await expect(
      useCase.execute({
        projectRoot: PROJECT,
        hosts: ["claude"],
        provider: "anthropic",
        main: true,
        scope: "project",
      })
    ).rejects.toThrow("disk full");

    expect(
      JSON.parse(fs.getFile(`${PROJECT}/.aidd/main-model.json`) ?? "{}").claude.previous
    ).toEqual({
      model: "mine",
      effortLevel: null,
    });
  });

  it("moves a main model already set to the new provider", async () => {
    const { fs, useCase } = setup();
    const base = { projectRoot: PROJECT, hosts: ["opencode"] as const, scope: "project" as const };

    await useCase.execute({ ...base, provider: "mistral", main: true });
    await useCase.execute({ ...base, provider: "openai" });

    expect(fs.getFile(`${PROJECT}/opencode.json`)).toBe('{\n  "model": "openai/gpt-6.1-sol"\n}\n');
  });

  it("refreshes this project globally too, and adds the machine-scope registrations", async () => {
    const userManifest = Manifest.create();
    userManifest.addTool("claude", "1.0.0", []);
    const { useCase, updates, activations } = setup((manifest) => {
      manifest.addTool("claude", "1.0.0", []);
      manifest.addPlugin("claude", plugin("project"));
    }, userManifest);

    await useCase.execute({
      projectRoot: PROJECT,
      hosts: ["claude"],
      provider: "anthropic",
      scope: "user",
    });

    expect(updates).toStrictEqual([{ toolIds: ["claude"], projectRoot: PROJECT, rebuild: true }]);
    expect(activations.map(({ toolIds, scope }) => ({ toolIds, scope }))).toStrictEqual([
      { toolIds: ["claude"], scope: undefined },
      { toolIds: ["claude"], scope: "user" },
    ]);
  });

  it("rewrites a plugin installed in the user's home whatever the scope", async () => {
    const userManifest = Manifest.create();
    userManifest.addTool("cursor", "1.0.0", []);
    userManifest.addPlugin("cursor", plugin("user"));
    const { useCase, userUpdates } = setup(undefined, userManifest);

    await useCase.execute({
      projectRoot: PROJECT,
      hosts: ["cursor"],
      provider: "anthropic",
      scope: "project",
    });

    expect(userUpdates).toStrictEqual([
      { toolIds: ["cursor"], projectRoot: PROJECT, scope: "user", rebuild: true },
    ]);
  });

  it("refuses a provider one host cannot run before writing anything", async () => {
    const { fs, useCase } = setup();

    await expect(
      useCase.execute({
        projectRoot: PROJECT,
        hosts: ["opencode", "claude"],
        provider: "mistral",
        main: true,
        scope: "project",
      })
    ).rejects.toThrow('Provider "mistral" is not supported for "claude". Use: anthropic.');
    expect(fs.listAll()).toStrictEqual([]);
  });
});
