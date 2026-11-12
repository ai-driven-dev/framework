import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FixturePluginFetcher } from "../../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const HOME = "/home/test";
const BUILT = "/cache/aidd-framework/codex";
const SOURCE = "/framework";
const PLUGIN = "aidd-orchestrator";
const PATH = "agents/aidd-orchestrator-executor.toml";
const BUILT_PATH = `${BUILT}/plugins/${PLUGIN}/codex-agents/executor.toml`;
const MARKETPLACE = Marketplace.fromJSON({
  name: "aidd-framework",
  source: { kind: "local", path: SOURCE },
  scope: "user",
  addedAt: "2026-01-01T00:00:00.000Z",
});

const dist = new PluginDistribution({
  manifest: { name: PLUGIN, version: "2.0.0" },
  format: "claude",
  files: [],
  components: {
    commands: [],
    agents: [{ relativePath: "agents/executor.md", content: "source" }],
    rules: [],
    skills: [],
    hooks: [],
    mcp: [],
  },
});

function canonicalAgent(instructions: string, model?: string, effort?: string): string {
  return [
    `description = "Executor ${instructions}"`,
    `developer_instructions = "${instructions}"`,
    ...(model === undefined ? [] : [`model = "${model}"`]),
    ...(effort === undefined ? [] : [`model_reasoning_effort = "${effort}"`]),
    "",
  ].join("\n");
}

async function fixture(
  installed: string,
  generated: string | undefined,
  recordedContent = canonicalAgent("old")
) {
  const fs = new InMemoryFileAdapter(generated === undefined ? {} : { [BUILT_PATH]: generated });
  const hasher = new DeterministicHasher();
  const logger = new CapturingLogger();
  const marketplaceRegistry = new InMemoryMarketplaceRegistry();
  await marketplaceRegistry.save(SOURCE, MARKETPLACE);
  const updater = new UserPluginFileUpdater(
    fs,
    new PluginDistributionLoader(new FixturePluginFetcher(), { read: async () => dist }),
    hasher,
    {
      homedir: () => HOME,
      marketplaceRegistry,
      ensureBuilt: fakeEnsureBuiltMarketplace(() => BUILT),
    }
  );
  const plugin = InstalledPlugin.fromMetadata(
    PLUGIN,
    "1.0.0",
    { kind: "local", path: SOURCE },
    false,
    "user",
    MARKETPLACE.name
  ).withFiles(new Map([[PATH, hasher.hash(recordedContent).value]]));
  fs.setFile(join(HOME, ".codex", PATH), installed);
  return { fs, hasher, logger, updater, plugin };
}

describe("owned Codex agent model migration", () => {
  it("retains model and effort in the manifest and generated hash across reloads", async () => {
    const generated = canonicalAgent("new");
    const f = await fixture(canonicalAgent("old", "gpt-6-luna", "high"), generated);
    const firstPlan = await f.updater.planUpdate(f.plugin, "codex", SOURCE, f.logger, true);
    if (firstPlan === null) throw new Error("expected first update plan");
    const first = await f.updater.applyUpdate(firstPlan, f.logger);

    expect(await f.fs.readFile(join(HOME, ".codex", PATH))).toBe(
      canonicalAgent("new", "gpt-6-luna", "high")
    );
    expect(first.userFileOverrides[PATH]).toEqual({
      model: "gpt-6-luna",
      model_reasoning_effort: "high",
    });
    expect(first.files.get(PATH)).toBe(
      f.hasher.hash(canonicalAgent("new", "gpt-6-luna", "high")).value
    );

    const secondPlan = await f.updater.planUpdate(first, "codex", SOURCE, f.logger, true);
    if (secondPlan === null) throw new Error("expected second update plan");
    const second = await f.updater.applyUpdate(secondPlan, f.logger);
    expect(await f.fs.readFile(join(HOME, ".codex", PATH))).toBe(
      canonicalAgent("new", "gpt-6-luna", "high")
    );
    expect(second.files.get(PATH)).toBe(first.files.get(PATH));
  });

  it("clears a retained override when the user restores the generated defaults", async () => {
    const generated = canonicalAgent("old");
    const recorded = canonicalAgent("old", "gpt-6-luna", "high");
    const f = await fixture(generated, generated, recorded);
    let plugin = f.plugin.withUserFileOverrides({
      [PATH]: { model: "gpt-6-luna", model_reasoning_effort: "high" },
    });
    for (let reload = 0; reload < 2; reload += 1) {
      const plan = await f.updater.planUpdate(plugin, "codex", SOURCE, f.logger, true);
      if (plan === null) throw new Error("expected default-reset plan");
      plugin = await f.updater.applyUpdate(plan, f.logger);
      expect(plugin.userFileOverrides).toEqual({});
      expect(await f.fs.readFile(join(HOME, ".codex", PATH))).toBe(generated);
      expect(plugin.files.get(PATH)).toBe(f.hasher.hash(generated).value);
    }
  });

  it("leaves a customized agent on disk when the distribution removes it", async () => {
    const customized = canonicalAgent("old", "gpt-6-luna", "high");
    const f = await fixture(customized, undefined, customized);
    const plugin = f.plugin.withUserFileOverrides({
      [PATH]: { model: "gpt-6-luna", model_reasoning_effort: "high" },
    });

    const plan = await f.updater.planUpdate(plugin, "codex", SOURCE, f.logger, true);
    if (plan === null) throw new Error("expected removed-agent update plan");
    const updated = await f.updater.applyUpdate(plan, f.logger);

    expect(updated.files.has(PATH)).toBe(false);
    expect(updated.userFileOverrides).toEqual({});
    expect(await f.fs.readFile(join(HOME, ".codex", PATH))).toBe(customized);
  });

  it("rejects unknown manifest settings before writing the agent", async () => {
    const installed = canonicalAgent("old");
    const f = await fixture(installed, canonicalAgent("new"));
    const plugin = f.plugin.withUserFileOverrides({
      [PATH]: { developer_instructions: "untrusted override" },
    });

    await expect(f.updater.planUpdate(plugin, "codex", SOURCE, f.logger, true)).rejects.toThrow(
      /Unsupported user file setting/
    );
    expect(await f.fs.readFile(join(HOME, ".codex", PATH))).toBe(installed);
  });

  it("rejects overrides for a tracked non-agent file before writing", async () => {
    const installed = canonicalAgent("old");
    const f = await fixture(installed, canonicalAgent("new"));
    const otherPath = "docs/settings.toml";
    const plugin = f.plugin
      .withFiles(new Map([...f.plugin.files, [otherPath, f.hasher.hash("setting = true").value]]))
      .withUserFileOverrides({ [otherPath]: { model: "gpt-6-luna" } });

    await expect(f.updater.planUpdate(plugin, "codex", SOURCE, f.logger, true)).rejects.toThrow(
      /Unsupported user file setting/
    );
    expect(await f.fs.readFile(join(HOME, ".codex", PATH))).toBe(installed);
  });

  it.each([
    [
      "unknown instruction edit",
      canonicalAgent("old", "gpt-6-luna", "high").replace("old", "custom"),
    ],
    ["noncanonical comments", `${canonicalAgent("old", "gpt-6-luna", "high")}# personal\n`],
  ])("refuses %s without changing the file", async (_label, installed) => {
    const f = await fixture(installed, canonicalAgent("new"));
    await expect(f.updater.planUpdate(f.plugin, "codex", SOURCE, f.logger, true)).rejects.toThrow(
      /was edited after install/
    );
    expect(await f.fs.readFile(join(HOME, ".codex", PATH))).toBe(installed);
  });

  it("refuses an owned agent file that resolves outside the Codex directory", async () => {
    const installed = canonicalAgent("old", "gpt-6-luna", "high");
    const f = await fixture(installed, canonicalAgent("new"));
    f.fs.setSymlink(join(HOME, ".codex", PATH), "/outside/agent.toml");
    await expect(f.updater.planUpdate(f.plugin, "codex", SOURCE, f.logger, true)).rejects.toThrow(
      /unsafe recorded files/
    );
    expect(await f.fs.readFile(join(HOME, ".codex", PATH))).toBe(installed);
  });

  it("rechecks the original bytes before applying a migration plan", async () => {
    const f = await fixture(canonicalAgent("old", "gpt-6-luna", "high"), canonicalAgent("new"));
    const plan = await f.updater.planUpdate(f.plugin, "codex", SOURCE, f.logger, true);
    if (plan === null) throw new Error("expected migration plan");
    f.fs.setFile(join(HOME, ".codex", PATH), canonicalAgent("changed", "gpt-6-luna", "high"));
    await expect(f.updater.applyUpdate(plan, f.logger)).rejects.toThrow(/was edited after install/);
  });
});
