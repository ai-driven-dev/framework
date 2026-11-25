import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import {
  CLAUDE_SETTINGS,
  CONFIG,
  HOME,
  OPENCODE_SCHEMA,
  OPENCODE_SETTINGS,
  PROJECT,
  plugin,
  setup,
} from "../testing/agent-models.builder.js";
import { HOST, HOST_CONFIG_DIR_ENV } from "../testing/synthetic-hosts.builder.js";

describe("setting agent models", () => {
  it("records the provider machine-wide, re-installs this project's plugins, then sets the main session", async () => {
    const { fs, useCase, updates, activations } = setup((manifest) => {
      manifest.addTool(HOST.mcp, "1.0.0", []);
      manifest.addPlugin(HOST.mcp, plugin("project"));
    });

    const result = await useCase.execute({
      projectRoot: PROJECT,
      hosts: [HOST.mcp],
      provider: "mistral",
      scope: "project",
    });

    expect(fs.getFile(`${CONFIG}/agent-models.json`)).toBe(`{\n  "${HOST.mcp}": "mistral"\n}\n`);
    expect(updates).toStrictEqual([{ toolIds: [HOST.mcp], projectRoot: PROJECT, rebuild: true }]);
    expect(activations).toStrictEqual([{ projectRoot: PROJECT, toolIds: [HOST.mcp] }]);
    expect(result.reinstalled).toStrictEqual(["aidd-orchestrator"]);
  });

  it("sets the main session on its tier's model, and restores what it replaced once unset", async () => {
    const { fs, useCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "mine"\n}\n');

    const set = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude],
      provider: "anthropic",
    });
    expect(set).toStrictEqual({
      reinstalled: [],
      changed: [{ host: HOST.claude, path: CLAUDE_SETTINGS }],
      skipped: [],
    });
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe(
      '{\n  "model": "claude-sonnet-5-5",\n  "effortLevel": "medium"\n}\n'
    );

    const unset = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude],
    });
    expect(unset.changed).toStrictEqual([{ host: HOST.claude, path: CLAUDE_SETTINGS }]);
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "mine"\n}\n');
    expect(fs.has(`${CONFIG}/main-model.json`)).toBe(false);
  });

  it("with agentsOnly, refreshes the agents and leaves the main session and its saved ownership untouched", async () => {
    const { fs, useCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "mine"\n}\n');
    const base = { projectRoot: PROJECT, scope: "project" as const, hosts: [HOST.claude] };
    await useCase.execute({ ...base, provider: "anthropic" });
    const mainSettings = fs.getFile(CLAUDE_SETTINGS);
    const ownership = fs.getFile(`${CONFIG}/main-model.json`);

    const result = await useCase.execute({ ...base, provider: "anthropic", agentsOnly: true });

    expect(result).toStrictEqual({ reinstalled: [], changed: [], skipped: [] });
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe(mainSettings);
    expect(fs.getFile(`${CONFIG}/main-model.json`)).toBe(ownership);
    expect(fs.getFile(`${CONFIG}/agent-models.json`)).toBe(
      `{\n  "${HOST.claude}": "anthropic"\n}\n`
    );
  });

  it("with agentsOnly on a machine that had no provider, records it and writes no main session", async () => {
    const { fs, useCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "mine"\n}\n');

    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude],
      provider: "anthropic",
      agentsOnly: true,
    });

    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "mine"\n}\n');
    expect(fs.has(`${CONFIG}/main-model.json`)).toBe(false);
    expect(fs.getFile(`${CONFIG}/agent-models.json`)).toBe(
      `{\n  "${HOST.claude}": "anthropic"\n}\n`
    );
  });

  it("writes the main model in the host's user settings, never a project file", async () => {
    const { fs, useCase } = setup();

    const result = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude, HOST.mcp, HOST.cursor],
      provider: "anthropic",
    });

    expect(fs.getFile(OPENCODE_SETTINGS)).toBe(
      `{\n  ${OPENCODE_SCHEMA},\n  "model": "anthropic/claude-sonnet-5-5"\n}\n`
    );
    expect(result.changed).toStrictEqual([
      { host: HOST.claude, path: CLAUDE_SETTINGS },
      { host: HOST.mcp, path: OPENCODE_SETTINGS },
    ]);
    expect(fs.listAll().filter((path) => path.startsWith(`${PROJECT}/`))).toStrictEqual([]);
  });

  it("follows CLAUDE_CONFIG_DIR to the settings file Claude Code reads", async () => {
    const custom = join(HOME, "claude-config");
    const { fs, useCase } = setup(undefined, null, undefined, (name) =>
      name === HOST_CONFIG_DIR_ENV ? custom : undefined
    );

    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude],
      provider: "anthropic",
    });

    expect(fs.has(join(custom, "settings.json"))).toBe(true);
    expect(fs.has(CLAUDE_SETTINGS)).toBe(false);
  });

  it("refreshes this project globally too, and adds the machine-scope registrations", async () => {
    const userManifest = Manifest.create();
    userManifest.addTool(HOST.claude, "1.0.0", []);
    const { useCase, updates, activations } = setup((manifest) => {
      manifest.addTool(HOST.claude, "1.0.0", []);
      manifest.addPlugin(HOST.claude, plugin("project"));
    }, userManifest);

    await useCase.execute({
      projectRoot: PROJECT,
      hosts: [HOST.claude],
      provider: "anthropic",
      scope: "user",
    });

    expect(updates).toStrictEqual([
      { toolIds: [HOST.claude], projectRoot: PROJECT, rebuild: true },
    ]);
    expect(activations.map(({ toolIds, scope }) => ({ toolIds, scope }))).toStrictEqual([
      { toolIds: [HOST.claude], scope: undefined },
      { toolIds: [HOST.claude], scope: "user" },
    ]);
  });

  it("rewrites a plugin installed in the user's home whatever the scope", async () => {
    const userManifest = aManifest()
      .withTool(HOST.cursor, [])
      .withPlugin(HOST.cursor, plugin("user"))
      .build();
    const { useCase, userUpdates } = setup(undefined, userManifest);

    await useCase.execute({
      projectRoot: PROJECT,
      hosts: [HOST.cursor],
      provider: "anthropic",
      scope: "project",
    });

    expect(userUpdates).toStrictEqual([
      { toolIds: [HOST.cursor], projectRoot: PROJECT, scope: "user", rebuild: true },
    ]);
  });

  it("puts the previous provider back when rebuilding this project's agents fails", async () => {
    const { fs, useCase } = setup((manifest) => {
      manifest.addTool(HOST.mcp, "1.0.0", []);
      manifest.addPlugin(HOST.mcp, plugin("project"));
    });
    const base = { projectRoot: PROJECT, scope: "project" as const, hosts: [HOST.mcp] };
    await useCase.execute({ ...base, provider: "mistral" });
    const failing = setup(
      (manifest) => {
        manifest.addTool(HOST.mcp, "1.0.0", []);
        manifest.addPlugin(HOST.mcp, plugin("project"));
      },
      null,
      fs,
      undefined,
      true
    );

    await expect(failing.useCase.execute({ ...base, provider: "openai" })).rejects.toThrow(
      "build failed"
    );

    expect(fs.getFile(`${CONFIG}/agent-models.json`)).toBe(`{\n  "${HOST.mcp}": "mistral"\n}\n`);
    expect(fs.getFile(OPENCODE_SETTINGS)).toContain("mistral/mistral-large-4");
  });

  it("refuses a provider one host cannot run before writing anything", async () => {
    const { fs, useCase } = setup();

    await expect(
      useCase.execute({
        projectRoot: PROJECT,
        hosts: [HOST.mcp, HOST.claude],
        provider: "mistral",
        scope: "project",
      })
    ).rejects.toThrow(`Provider "mistral" is not supported for "${HOST.claude}". Use: anthropic.`);
    expect(fs.listAll()).toStrictEqual([]);
  });

  it("refuses a provider for a host that runs no agent provider at all", async () => {
    const { fs, useCase } = setup();

    await expect(
      useCase.execute({
        projectRoot: PROJECT,
        hosts: [HOST.copilot],
        provider: "anthropic",
        scope: "project",
      })
    ).rejects.toThrow(`No agent provider is supported for "${HOST.copilot}".`);
    expect(fs.listAll()).toStrictEqual([]);
  });
});
