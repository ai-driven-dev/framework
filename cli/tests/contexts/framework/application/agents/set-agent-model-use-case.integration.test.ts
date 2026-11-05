import { join } from "node:path";
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
const CLAUDE_SETTINGS = join(HOME, ".claude", "settings.json");
const OPENCODE_SETTINGS = join(HOME, ".config", "opencode", "opencode.json");

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
  fs: InMemoryFileAdapter = new InMemoryFileAdapter(),
  env: (name: string) => string | undefined = () => undefined,
  updateFails = false
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
        if (updateFails) throw new Error("build failed");
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
    env
  );
  return { fs, useCase, updates, userUpdates, activations };
}

describe("SetAgentModelUseCase", () => {
  it("records the provider machine-wide, re-installs this project's plugins, then sets the main session", async () => {
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
    expect(result.reinstalled).toStrictEqual(["aidd-orchestrator"]);
  });

  it("sets the main session on its tier's model, and restores what it replaced once unset", async () => {
    const { fs, useCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "mine"\n}\n');

    const set = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["claude"],
      provider: "anthropic",
    });
    expect(set).toStrictEqual({
      reinstalled: [],
      changed: [{ host: "claude", path: CLAUDE_SETTINGS }],
      skipped: [],
    });
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe(
      '{\n  "model": "claude-sonnet-5-5",\n  "effortLevel": "medium"\n}\n'
    );

    const unset = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["claude"],
    });
    expect(unset.changed).toStrictEqual([{ host: "claude", path: CLAUDE_SETTINGS }]);
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "mine"\n}\n');
    expect(fs.has(`${CONFIG}/main-model.json`)).toBe(false);
  });

  it("writes the main model in the host's user settings, never a project file", async () => {
    const { fs, useCase } = setup();

    const result = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["claude", "opencode", "cursor"],
      provider: "anthropic",
    });

    expect(fs.getFile(OPENCODE_SETTINGS)).toBe('{\n  "model": "anthropic/claude-sonnet-5-5"\n}\n');
    expect(result.changed).toStrictEqual([
      { host: "claude", path: CLAUDE_SETTINGS },
      { host: "opencode", path: OPENCODE_SETTINGS },
    ]);
    expect(fs.listAll().filter((path) => path.startsWith(`${PROJECT}/`))).toStrictEqual([]);
  });

  it("follows CLAUDE_CONFIG_DIR to the settings file Claude Code reads", async () => {
    const custom = join(HOME, "claude-config");
    const { fs, useCase } = setup(undefined, null, undefined, (name) =>
      name === "CLAUDE_CONFIG_DIR" ? custom : undefined
    );

    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["claude"],
      provider: "anthropic",
    });

    expect(fs.has(join(custom, "settings.json"))).toBe(true);
    expect(fs.has(CLAUDE_SETTINGS)).toBe(false);
  });

  it("writes where Claude Code reads now, and restores the file it wrote before", async () => {
    let configDir: string | undefined;
    const { fs, useCase } = setup(undefined, null, undefined, (name) =>
      name === "CLAUDE_CONFIG_DIR" ? configDir : undefined
    );
    const base = { projectRoot: PROJECT, scope: "project" as const, hosts: ["claude"] as const };
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "opus"\n}\n');

    await useCase.execute({ ...base, provider: "anthropic" });
    configDir = join(HOME, "claude-config");
    await useCase.execute({ ...base });

    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "opus"\n}\n');
    expect(fs.has(join(HOME, "claude-config", "settings.json"))).toBe(false);
  });

  it("writes OpenCode's JSONC config when it is the only one there", async () => {
    const { fs, useCase } = setup();
    fs.setFile(`${OPENCODE_SETTINGS}c`, '{\n  "theme": "dark"\n}\n');

    const result = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["opencode"],
      provider: "openai",
    });

    expect(result.changed).toStrictEqual([{ host: "opencode", path: `${OPENCODE_SETTINGS}c` }]);
    expect(fs.has(OPENCODE_SETTINGS)).toBe(false);
  });

  it("skips a settings file holding comments, writing nothing, and goes on with the others", async () => {
    const { fs, useCase } = setup();
    const commented = '{\n  // mine\n  "model": "opus"\n}\n';
    fs.setFile(CLAUDE_SETTINGS, commented);

    const result = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["claude", "opencode"],
      provider: "anthropic",
    });

    expect(fs.getFile(CLAUDE_SETTINGS)).toBe(commented);
    expect(result.skipped).toStrictEqual([
      {
        host: "claude",
        path: CLAUDE_SETTINGS,
        reason: "it holds comments or trailing commas, which rewriting it would drop",
      },
    ]);
    expect(result.changed).toStrictEqual([{ host: "opencode", path: OPENCODE_SETTINGS }]);
  });

  it("keeps the record of a file it cannot read, so a later run can still restore it", async () => {
    const { fs, useCase } = setup();
    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["claude"],
      provider: "anthropic",
    });
    fs.setFile(CLAUDE_SETTINGS, "// broken");

    const result = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["claude"],
    });

    expect(result.skipped.map(({ host }) => host)).toStrictEqual(["claude"]);
    expect(JSON.parse(fs.getFile(`${CONFIG}/main-model.json`) ?? "{}")).toHaveProperty("claude");
  });

  it("records what a settings file held before writing it, so a failed run can still restore it", async () => {
    const fs = new FaultingFileAdapter();
    const { useCase } = setup(undefined, null, fs);
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "mine"\n}\n');
    fs.failOn("writeFile", CLAUDE_SETTINGS, new Error("disk full"));

    await expect(
      useCase.execute({
        projectRoot: PROJECT,
        scope: "project",
        hosts: ["claude"],
        provider: "anthropic",
      })
    ).rejects.toThrow("disk full");

    expect(JSON.parse(fs.getFile(`${CONFIG}/main-model.json`) ?? "{}").claude.previous).toEqual({
      model: "mine",
      effortLevel: null,
    });
  });

  it("moves a main model already set to the new provider", async () => {
    const { fs, useCase } = setup();

    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["opencode"],
      provider: "mistral",
    });
    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["opencode"],
      provider: "openai",
    });

    expect(fs.getFile(OPENCODE_SETTINGS)).toBe('{\n  "model": "openai/gpt-6.1-terra"\n}\n');
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

  it("resets the machine: restores every main session it changed and forgets the providers", async () => {
    const { fs, useCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "opus"\n}\n');
    const base = { projectRoot: PROJECT, scope: "project" as const };
    await useCase.execute({ ...base, hosts: ["claude", "opencode"], provider: "anthropic" });

    const preview = await useCase.reset({ dryRun: true });
    expect(preview.providers).toStrictEqual(["claude", "opencode"]);
    expect(preview.changed.map(({ host }) => host)).toStrictEqual(["claude", "opencode"]);
    expect(fs.getFile(CLAUDE_SETTINGS)).toContain("claude-sonnet-5-5");

    await useCase.reset({ dryRun: false });
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "opus"\n}\n');
    expect(fs.has(OPENCODE_SETTINGS)).toBe(false);
    expect(fs.has(`${CONFIG}/agent-models.json`)).toBe(false);
    expect(fs.has(`${CONFIG}/main-model.json`)).toBe(false);
  });

  it("restores the file it wrote before when the host now reads another one", async () => {
    let configDir: string | undefined;
    const { fs, useCase } = setup(undefined, null, undefined, (name) =>
      name === "CLAUDE_CONFIG_DIR" ? configDir : undefined
    );
    const base = { projectRoot: PROJECT, scope: "project" as const, hosts: ["claude"] as const };
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "opus"\n}\n');
    await useCase.execute({ ...base, provider: "anthropic" });

    configDir = join(HOME, "claude-config");
    const moved = await useCase.execute({ ...base, provider: "anthropic" });

    const custom = join(HOME, "claude-config", "settings.json");
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "opus"\n}\n');
    expect(fs.getFile(custom)).toContain("claude-sonnet-5-5");
    expect(moved.changed.at(-1)).toStrictEqual({ host: "claude", path: custom });
  });

  it("puts the previous provider back when rebuilding this project's agents fails", async () => {
    const { fs, useCase } = setup((manifest) => {
      manifest.addTool("opencode", "1.0.0", []);
      manifest.addPlugin("opencode", plugin("project"));
    });
    const base = { projectRoot: PROJECT, scope: "project" as const, hosts: ["opencode"] as const };
    await useCase.execute({ ...base, provider: "mistral" });
    const failing = setup(
      (manifest) => {
        manifest.addTool("opencode", "1.0.0", []);
        manifest.addPlugin("opencode", plugin("project"));
      },
      null,
      fs,
      undefined,
      true
    );

    await expect(failing.useCase.execute({ ...base, provider: "openai" })).rejects.toThrow(
      "build failed"
    );

    expect(fs.getFile(`${CONFIG}/agent-models.json`)).toBe('{\n  "opencode": "mistral"\n}\n');
    expect(fs.getFile(OPENCODE_SETTINGS)).toContain("mistral/mistral-large-4");
  });

  it("forgets the provider on reset even when a settings file cannot be restored, and keeps its record", async () => {
    const { fs, useCase } = setup();
    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: ["claude"],
      provider: "anthropic",
    });
    fs.setFile(CLAUDE_SETTINGS, '{\n  // mine\n  "model": "claude-sonnet-5-5"\n}\n');

    const reset = await useCase.reset({ dryRun: false });

    expect(reset.skipped.map(({ host }) => host)).toStrictEqual(["claude"]);
    expect(fs.has(`${CONFIG}/agent-models.json`)).toBe(false);
    expect(JSON.parse(fs.getFile(`${CONFIG}/main-model.json`) ?? "{}")).toHaveProperty("claude");
  });

  it("refuses a provider one host cannot run before writing anything", async () => {
    const { fs, useCase } = setup();

    await expect(
      useCase.execute({
        projectRoot: PROJECT,
        hosts: ["opencode", "claude"],
        provider: "mistral",
        scope: "project",
      })
    ).rejects.toThrow('Provider "mistral" is not supported for "claude". Use: anthropic.');
    expect(fs.listAll()).toStrictEqual([]);
  });
});
