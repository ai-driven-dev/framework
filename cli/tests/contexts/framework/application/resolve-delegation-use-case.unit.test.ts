import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../src/runtime/wiring/tools.js";
import { ResolveDelegationUseCase } from "../../../../src/contexts/framework/application/resolve-delegation-use-case.js";
import { FakeHostPluginRegistryReader } from "../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../helpers/ports/in-memory-manifest-repository.js";

const ROOT = "/repo";
const HOME = "/person";
const CONFIG = join(ROOT, ".aidd", "config.json");

function setup(tool: string, settings: Record<string, string> = {}) {
  const raw = JSON.stringify({
    telemetry: { enabled: true },
    custom: { keep: 1 },
    delegation: { exploration: { agent: "aidd-dev:explorer", tools: { [tool]: settings } } },
  });
  const fs = new InMemoryFileAdapter({ [CONFIG]: raw });
  const repo = new InMemoryManifestRepository(null, ROOT);
  const useCase = new ResolveDelegationUseCase(fs, repo, new Map());
  return {
    fs,
    repo,
    raw,
    resolve: () =>
      useCase.execute({ projectRoot: ROOT, home: HOME, env: {}, task: "exploration", tool }),
  };
}

describe("resolving an installed delegation suggestion", () => {
  it("returns no suggestion when the task is absent without writing configuration", async () => {
    const fs = new InMemoryFileAdapter();
    const useCase = new ResolveDelegationUseCase(fs, new InMemoryManifestRepository(), new Map());
    const result = await useCase.execute({
      projectRoot: ROOT,
      home: HOME,
      env: {},
      task: "exploration",
      tool: "codex",
    });
    expect(result).toMatchObject({
      configured: false,
      requested: {},
      native: {},
      effectiveRuntime: "unknown",
    });
    expect(await fs.fileExists(CONFIG)).toBe(false);
  });

  it("preserves a registered unsupported host's existing behavior when no task is configured", async () => {
    const fs = new InMemoryFileAdapter();
    const useCase = new ResolveDelegationUseCase(fs, new InMemoryManifestRepository(), new Map());
    const result = await useCase.execute({
      projectRoot: ROOT,
      home: HOME,
      env: {},
      task: "exploration",
      tool: "kilo",
    });
    expect(result).toMatchObject({ configured: false, requested: {}, native: {} });
    expect(await fs.fileExists(CONFIG)).toBe(false);
  });

  it.each([
    [
      "codex",
      ".codex/agents/aidd-dev-explorer.toml",
      'name = "aidd-dev-explorer"\ndescription = "Explore"\ndeveloper_instructions = "Body"',
      "model_reasoning_effort",
    ],
    [
      "claude",
      ".claude/agents/aidd-dev-explorer.md",
      "---\nname: aidd-dev-explorer\ndescription: Explore\n---\nBody",
      "effort",
    ],
    [
      "opencode",
      ".opencode/agents/aidd-dev-explorer.md",
      "---\nname: aidd-dev-explorer\nmode: subagent\n---\nBody",
      "variant",
    ],
    [
      "copilot",
      ".github/agents/aidd-dev-explorer.agent.md",
      "---\nname: aidd-dev-explorer\n---\nBody",
      "reasoningEffort",
    ],
    [
      "cursor",
      ".cursor/agents/aidd-dev-explorer.md",
      "---\nname: aidd-dev-explorer\n---\nBody",
      "embedded",
    ],
  ])(
    "adapts %s settings using the installed artifact",
    async (tool, path, content, effortField) => {
      const { fs, repo, raw, resolve } = setup(tool, { model: "native-model", effort: "high" });
      await fs.writeFile(join(ROOT, path), content);
      const result = await resolve();
      expect(result.agent).toMatchObject({
        name: "aidd-dev-explorer",
        path: join(ROOT, path),
        mode: "flat",
      });
      expect(result.requested).toEqual({ model: "native-model", effort: "high" });
      expect(result.native).toEqual(
        effortField === "embedded"
          ? { model: "native-model[effort=high]" }
          : effortField === "variant"
            ? { model: "native-model#high" }
            : { model: "native-model", [effortField]: "high" }
      );
      expect(result.effectiveRuntime).toBe("unknown");
      expect(await fs.readFile(CONFIG)).toBe(raw);
      expect(repo.saveCount).toBe(0);
    }
  );

  it("honors CODEX_HOME and inherits omitted settings", async () => {
    const { fs, repo } = setup("codex");
    const path = join("/custom/codex", "agents", "aidd-dev-explorer.toml");
    await fs.writeFile(path, 'name = "actual-role"\ndeveloper_instructions = "Body"');
    const useCase = new ResolveDelegationUseCase(fs, repo, new Map());
    const result = await useCase.execute({
      projectRoot: ROOT,
      home: HOME,
      env: { CODEX_HOME: "/custom/codex" },
      task: "exploration",
      tool: "codex",
    });
    expect(result.agent).toMatchObject({ name: "actual-role", path });
    expect(result.native).toEqual({});
  });

  it("uses the Copilot personal agent before the same project ID", async () => {
    const selected = setup("copilot");
    await selected.fs.writeFile(
      "/repo/.github/agents/aidd-dev-explorer.agent.md",
      "---\nname: Project\n---\nProject behavior"
    );
    await selected.fs.writeFile(
      "/person/.copilot/agents/aidd-dev-explorer.agent.md",
      "---\nname: Personal\n---\nPersonal behavior"
    );
    expect((await selected.resolve()).agent?.path).toBe(
      join(HOME, ".copilot", "agents", "aidd-dev-explorer.agent.md")
    );
  });

  it("honors CLAUDE_CONFIG_DIR without reading the same role from the default profile", async () => {
    const selected = setup("claude");
    await selected.fs.writeFile(
      "/person/.claude/agents/aidd-dev-explorer.md",
      "---\nname: wrong-agent\n---\nBody"
    );
    await selected.fs.writeFile(
      "/relocated/agents/aidd-dev-explorer.md",
      "---\nname: selected-agent\n---\nBody"
    );
    const result = await new ResolveDelegationUseCase(
      selected.fs,
      selected.repo,
      new Map()
    ).execute({
      projectRoot: ROOT,
      home: HOME,
      env: { CLAUDE_CONFIG_DIR: "/relocated" },
      task: "exploration",
      tool: "claude",
    });
    expect(result.agent).toMatchObject({
      name: "selected-agent",
      path: join("/relocated", "agents", "aidd-dev-explorer.md"),
    });
  });

  it.each([
    ["claude", ".claude/agents/aidd-dev-explorer.md", "---\nname: aidd-dev-explorer\n---\nBody"],
    ["opencode", ".config/opencode/agents/aidd-dev-explorer.md", "---\nmode: subagent\n---\nBody"],
    ["copilot", ".copilot/agents/aidd-dev-explorer.agent.md", "---\nname: Display name\n---\nBody"],
    ["cursor", ".cursor/agents/aidd-dev-explorer.md", "---\nname: aidd-dev-explorer\n---\nBody"],
  ])(
    "finds the %s personal agent and leaves all unspecified settings inherited",
    async (tool, relative, content) => {
      const { fs, resolve } = setup(tool);
      await fs.writeFile(join(HOME, relative), content);
      const result = await resolve();
      expect(result.agent).toMatchObject({
        name: "aidd-dev-explorer",
        path: join(HOME, relative),
        mode: "flat",
      });
      expect(result.requested).toEqual({});
      expect(result.native).toEqual({});
    }
  );

  it.each([
    ...["low", "medium", "high", "xhigh", "max"].map((effort) => [
      "claude",
      effort,
      ".claude/agents/aidd-dev-explorer.md",
      "effort",
    ]),
    ...["none", "minimal", "low", "medium", "high", "xhigh", "max"].map((effort) => [
      "copilot",
      effort,
      ".github/agents/aidd-dev-explorer.agent.md",
      "reasoningEffort",
    ]),
    [
      "codex",
      "model-defined-custom-effort",
      ".codex/agents/aidd-dev-explorer.toml",
      "model_reasoning_effort",
    ],
  ])(
    "preserves %s's declared effort %s without adding a model",
    async (tool, effort, path, field) => {
      const { fs, resolve } = setup(tool, { effort });
      await fs.writeFile(
        join(ROOT, path),
        path.endsWith(".toml")
          ? 'name = "aidd-dev-explorer"'
          : "---\nname: aidd-dev-explorer\n---\nBody"
      );
      const result = await resolve();
      expect(result.native).toEqual({ [field]: effort });
    }
  );

  it("names a missing agent and how to repair its installation", async () => {
    await expect(setup("codex").resolve()).rejects.toThrow(
      /aidd-dev:explorer.*not found.*install/i
    );
  });

  it("uses an enabled native plugin's actual install path and its host namespace", async () => {
    const { fs, repo } = setup("claude");
    await fs.writeFile("/native/aidd-dev/agents/explorer.md", "---\nname: explorer\n---\nBody");
    const registry = new FakeHostPluginRegistryReader({
      location: "/registry.json",
      refs: new Map([
        [
          "aidd-dev@my-market",
          { enabled: true, scope: "project", installPath: "/native/aidd-dev" },
        ],
      ]),
    });
    const result = await new ResolveDelegationUseCase(
      fs,
      repo,
      new Map([["claude", registry]])
    ).execute({ projectRoot: ROOT, home: HOME, env: {}, task: "exploration", tool: "claude" });
    expect(result.agent).toEqual({
      name: "aidd-dev:explorer",
      path: join("/native/aidd-dev", "agents", "explorer.md"),
      mode: "marketplace",
    });
  });

  it("uses the Copilot plugin filename as its namespace rather than the display name", async () => {
    const { fs, repo } = setup("copilot");
    await fs.writeFile(
      "/live/aidd-dev/agents/explorer.md",
      "---\nname: Different display name\n---\nBody"
    );
    const registry = new FakeHostPluginRegistryReader({
      location: "/settings.json",
      refs: new Map([["aidd-dev@market", { enabled: true, installPath: "/live/aidd-dev" }]]),
    });
    const result = await new ResolveDelegationUseCase(
      fs,
      repo,
      new Map([["copilot", registry]])
    ).execute({ projectRoot: ROOT, home: HOME, env: {}, task: "exploration", tool: "copilot" });
    expect(result.agent).toMatchObject({ name: "aidd-dev:explorer", mode: "marketplace" });
  });

  it("prefers the project agent over a user agent and refuses disabled native plugins", async () => {
    const { fs, repo } = setup("codex");
    await fs.writeFile("/repo/.codex/agents/aidd-dev-explorer.toml", 'name = "project-agent"');
    await fs.writeFile("/person/.codex/agents/aidd-dev-explorer.toml", 'name = "user-agent"');
    expect(
      (
        await new ResolveDelegationUseCase(fs, repo, new Map()).execute({
          projectRoot: ROOT,
          home: HOME,
          env: {},
          task: "exploration",
          tool: "codex",
        })
      ).agent?.name
    ).toBe("project-agent");
    const disabled = setup("claude");
    await disabled.fs.writeFile(
      "/native/aidd-dev/agents/explorer.md",
      "---\nname: explorer\n---\nBody"
    );
    const registry = new FakeHostPluginRegistryReader({
      location: "/registry.json",
      refs: new Map([["aidd-dev@my-market", { enabled: false, installPath: "/native/aidd-dev" }]]),
    });
    await expect(
      new ResolveDelegationUseCase(
        disabled.fs,
        disabled.repo,
        new Map([["claude", registry]])
      ).execute({ projectRoot: ROOT, home: HOME, env: {}, task: "exploration", tool: "claude" })
    ).rejects.toThrow("disabled");
  });

  it("rejects an unsupported host, effort, and Cursor effort without an explicit model", async () => {
    await expect(setup("kilo").resolve()).rejects.toThrow(/does not support/);
    const invalid = setup("claude", { effort: "maximum-ish" });
    await invalid.fs.writeFile(
      "/repo/.claude/agents/aidd-dev-explorer.md",
      "---\nname: aidd-dev-explorer\n---\nBody"
    );
    await expect(invalid.resolve()).rejects.toThrow(/effort/);
    const missingModel = setup("cursor", { effort: "high" });
    await missingModel.fs.writeFile(
      "/repo/.cursor/agents/aidd-dev-explorer.md",
      "---\nname: aidd-dev-explorer\n---\nBody"
    );
    await expect(missingModel.resolve()).rejects.toThrow(/explicit model/);
  });

  it("distinguishes Cursor plugin spawn settings from flat agent configuration", async () => {
    const plugin = setup("cursor", { model: "user-catalog-slug" });
    await plugin.fs.writeFile(
      "/person/.cursor/plugins/local/aidd-dev/agents/explorer.md",
      "---\nname: aidd-dev-explorer\n---\nBody"
    );
    const result = await plugin.resolve();
    expect(result.agent?.name).toBe("aidd-dev-explorer");
    expect(result.nativeSurface).toBe("spawn");
    expect(result.native).toEqual({ model: "user-catalog-slug" });
    const effort = setup("cursor", { model: "user-catalog-slug", effort: "high" });
    await effort.fs.writeFile(
      "/person/.cursor/plugins/local/aidd-dev/agents/explorer.md",
      "---\nname: aidd-dev-explorer\n---\nBody"
    );
    await expect(effort.resolve()).rejects.toThrow(/spawn does not accept effort/);
  });

  it("refuses an older bare Cursor plugin role that could collide with a personal agent", async () => {
    const plugin = setup("cursor");
    await plugin.fs.writeFile(
      "/person/.cursor/plugins/local/aidd-dev/agents/explorer.md",
      "---\nname: explorer\n---\nAIDD"
    );
    await plugin.fs.writeFile(
      "/repo/.cursor/agents/explorer.md",
      "---\nname: explorer\n---\nOther"
    );
    await expect(plugin.resolve()).rejects.toThrow(/reinstall.*aidd-dev-explorer/);
  });

  it("rejects an invalid installed Codex agent instead of inventing its identity", async () => {
    const invalid = setup("codex");
    await invalid.fs.writeFile(
      "/repo/.codex/agents/aidd-dev-explorer.toml",
      'description = "No native name"'
    );
    await expect(invalid.resolve()).rejects.toThrow(/name/);
  });

  it("reports installed Codex pins that a spawn override would not replace", async () => {
    const pinned = setup("codex", { model: "requested-model", effort: "high" });
    await pinned.fs.writeFile(
      "/repo/.codex/agents/aidd-dev-explorer.toml",
      'name = "aidd-dev-explorer"\nmodel = "pinned-model"\nmodel_reasoning_effort = "low"'
    );
    const result = await pinned.resolve();
    expect(result.native).toEqual({ model: "requested-model", model_reasoning_effort: "high" });
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics.join(" ")).toContain("pinned-model");
    expect(result.diagnostics.join(" ")).toContain("requested-model");
    expect(result.diagnostics.join(" ")).toContain("low");
    expect(result.effectiveRuntime).toBe("unknown");
  });

  it("leaves absent and matching Codex pins free of conflict diagnostics", async () => {
    const selected = setup("codex", { model: "requested-model", effort: "high" });
    await selected.fs.writeFile(
      "/repo/.codex/agents/aidd-dev-explorer.toml",
      'name = "aidd-dev-explorer"'
    );
    expect((await selected.resolve()).diagnostics).toEqual([]);
    await selected.fs.writeFile(
      "/repo/.codex/agents/aidd-dev-explorer.toml",
      'name = "aidd-dev-explorer"\nmodel = "requested-model"\nmodel_reasoning_effort = "high"'
    );
    expect((await selected.resolve()).diagnostics).toEqual([]);
  });

  it.each([
    [
      "opencode",
      ".opencode/agents/aidd-dev-explorer.md",
      "provider/model#high",
      "provider/model#low",
    ],
    [
      "cursor",
      ".cursor/agents/aidd-dev-explorer.md",
      "native-model[effort=high]",
      "native-model[effort=low]",
    ],
  ])(
    "preserves literal %s selectors and rejects conflicting effort instead of replacing it",
    async (tool, path, same, conflicting) => {
      const literal = setup(tool, { model: same });
      await literal.fs.writeFile(join(ROOT, path), "---\nname: aidd-dev-explorer\n---\nBody");
      expect((await literal.resolve()).native).toEqual({ model: same });
      const matching = setup(tool, { model: same, effort: "high" });
      await matching.fs.writeFile(join(ROOT, path), "---\nname: aidd-dev-explorer\n---\nBody");
      expect((await matching.resolve()).native).toEqual({ model: same });
      const conflict = setup(tool, { model: conflicting, effort: "high" });
      await conflict.fs.writeFile(join(ROOT, path), "---\nname: aidd-dev-explorer\n---\nBody");
      await expect(conflict.resolve()).rejects.toThrow(/Conflicting/);
    }
  );

  it.each([
    ["claude-opus-4-8[context=1m]", "claude-opus-4-8[context=1m,effort=high]"],
    [
      "claude-opus-4-8[context=1m,effort=high,fast=false]",
      "claude-opus-4-8[context=1m,effort=high,fast=false]",
    ],
  ])(
    "merges Cursor effort into the existing parameter group while preserving other options",
    async (model, expected) => {
      const selected = setup("cursor", { model, effort: "high" });
      await selected.fs.writeFile(
        "/repo/.cursor/agents/aidd-dev-explorer.md",
        "---\nname: aidd-dev-explorer\n---\nBody"
      );
      expect((await selected.resolve()).native).toEqual({ model: expected });
    }
  );

  it.each([
    ["claude-opus-4-8[context=1m,effort=high,fast=false]", "low", "Conflicting"],
    ["model[context=]", "high", "Malformed"],
    ["model[context=1m][fast=false]", "high", "Malformed"],
    ["model[effort=high,effort=high]", "high", "Malformed"],
    ["model[context=1m", "high", "Malformed"],
  ])("refuses a conflicting or malformed Cursor parameter group", async (model, effort, reason) => {
    const selected = setup("cursor", { model, effort });
    await selected.fs.writeFile(
      "/repo/.cursor/agents/aidd-dev-explorer.md",
      "---\nname: aidd-dev-explorer\n---\nBody"
    );
    await expect(selected.resolve()).rejects.toMatchObject({
      message: expect.stringContaining(reason),
    });
  });

  it("passes a literal Cursor model unchanged when effort is omitted", async () => {
    const selected = setup("cursor", { model: "user-literal[opaque-native-option]" });
    await selected.fs.writeFile(
      "/repo/.cursor/agents/aidd-dev-explorer.md",
      "---\nname: aidd-dev-explorer\n---\nBody"
    );
    expect((await selected.resolve()).native).toEqual({
      model: "user-literal[opaque-native-option]",
    });
  });
});
