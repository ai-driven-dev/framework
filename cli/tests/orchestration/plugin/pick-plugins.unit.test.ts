import { describe, expect, it, vi } from "vitest";
import type { ResolveMarketplaceCommand } from "../../../src/contexts/distribution/application/resolve-marketplace.js";
import type { PluginCatalogEntry } from "../../../src/contexts/distribution/contract/catalog.js";
import type { MarketplaceView } from "../../../src/contexts/distribution/contract/marketplace-view.js";
import type { PluginAddOptions } from "../../../src/contexts/installation/application/plugin/add/plugin-add.js";
import {
  InteractiveOnlyError,
  NoMarketplacesRegisteredError,
} from "../../../src/orchestration/orchestration.error.js";
import { PickPlugins } from "../../../src/orchestration/plugin/pick-plugins.js";
import { InvalidPluginManifestError } from "../../../src/shared/domain/shared.error.js";
import { CheckboxRecordingPrompter } from "../../shared/testing/checkbox-recording-prompter.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

const PROJECT = "/project";

function marketplace(name: string, kind: "local" | "github" = "local"): MarketplaceView {
  return {
    name,
    source: kind === "local" ? { kind, path: `/${name}` } : { kind, repo: `org/${name}` },
    scope: "project",
    addedAt: "x",
  };
}

function entry(name: string, extra: Partial<PluginCatalogEntry> = {}): PluginCatalogEntry {
  return {
    name,
    source: { kind: "local", path: `/plugins/${name}` },
    recommended: false,
    strict: false,
    ...extra,
  };
}

/** Picks the marketplace named first in `marketplaceChoice` and the plugins in `selection`. */
class PickingPrompter extends CheckboxRecordingPrompter {
  readonly marketplaceAsks: string[][] = [];

  constructor(
    private readonly pluginNames: readonly string[],
    private readonly marketplaceChoice = ""
  ) {
    super();
  }

  override async checkbox<T>(
    message: string,
    choices: Array<{ name: string; value: T; checked?: boolean; disabled?: boolean | string }>
  ): Promise<T[]> {
    await super.checkbox(message, choices);
    return choices.filter((c) => this.pluginNames.includes(c.name)).map((c) => c.value);
  }

  override async select<T>(
    _message: string,
    choices: Array<{ name: string; value: T; disabled?: boolean | string }>
  ): Promise<T> {
    this.marketplaceAsks.push(choices.map((c) => c.name));
    const chosen = choices.find((c) => c.name.startsWith(this.marketplaceChoice));
    if (chosen === undefined) throw new Error("no such marketplace");
    return chosen.value;
  }
}

function build(options: {
  marketplaces: MarketplaceView[];
  plugins?: PluginCatalogEntry[] | null;
  prompter?: PickingPrompter;
}) {
  const added: PluginAddOptions[] = [];
  const prompter = options.prompter ?? new PickingPrompter([]);
  const resolveMarketplace = {
    execute: vi.fn(async ({ marketplace }: ResolveMarketplaceCommand) => ({
      marketplace,
      localPath: "/cache/mkt",
      catalog: options.plugins === null ? null : { plugins: options.plugins ?? [] },
    })),
  };
  const useCase = new PickPlugins(
    { execute: async () => ({ marketplaces: options.marketplaces }) },
    resolveMarketplace,
    {
      execute: async (command) => {
        added.push(command);
      },
    },
    prompter
  );
  return { useCase, added, prompter, resolveMarketplace };
}

const command = { toolIds: [TOOL.claude], projectRoot: PROJECT, interactive: true };

describe("PickPlugins", () => {
  it("refuses a run that cannot ask", async () => {
    const { useCase } = build({ marketplaces: [marketplace("one")] });

    await expect(useCase.execute({ ...command, interactive: false })).rejects.toThrow(
      InteractiveOnlyError
    );
  });

  it("refuses when no marketplace is registered", async () => {
    const { useCase } = build({ marketplaces: [] });

    await expect(useCase.execute(command)).rejects.toThrow(NoMarketplacesRegisteredError);
  });

  it("takes the only marketplace without asking and installs the plugins ticked", async () => {
    const one = marketplace("one");
    const { useCase, added, prompter } = build({
      marketplaces: [one],
      plugins: [entry("alpha", { version: "1.2.0", strict: true }), entry("beta")],
      prompter: new PickingPrompter(["alpha"]),
    });

    const result = await useCase.execute(command);

    expect(prompter.marketplaceAsks).toEqual([]);
    expect(result).toEqual({ marketplace: one, installed: ["alpha"] });
    expect(added).toEqual([
      {
        source: { kind: "local", path: "/plugins/alpha" },
        toolIds: [TOOL.claude],
        projectRoot: PROJECT,
        interactive: true,
        marketplace: "one",
        githubMarketplace: false,
        pluginMetadata: { name: "alpha", version: "1.2.0", strict: true },
        replace: true,
      },
    ]);
  });

  it("asks which marketplace when several are registered and reads the one chosen", async () => {
    const { useCase, prompter, resolveMarketplace } = build({
      marketplaces: [marketplace("one"), marketplace("two", "github")],
      plugins: [entry("alpha")],
      prompter: new PickingPrompter(["alpha"], "two"),
    });

    const result = await useCase.execute(command);

    expect(prompter.marketplaceAsks).toEqual([["one [project]", "two [project]"]]);
    expect(resolveMarketplace.execute).toHaveBeenCalledWith({
      marketplace: result.marketplace,
      projectRoot: PROJECT,
    });
    expect(result.marketplace.name).toBe("two");
  });

  it("marks the install as github when the marketplace is one", async () => {
    const { useCase, added } = build({
      marketplaces: [marketplace("hub", "github")],
      plugins: [entry("alpha")],
      prompter: new PickingPrompter(["alpha"]),
    });

    await useCase.execute(command);

    expect(added[0].githubMarketplace).toBe(true);
  });

  it("installs nothing when the marketplace lists no plugin, without asking", async () => {
    const { useCase, added, prompter } = build({ marketplaces: [marketplace("one")], plugins: [] });

    const result = await useCase.execute(command);

    expect(result.installed).toEqual([]);
    expect(added).toEqual([]);
    expect(prompter.asks).toEqual([]);
  });

  it("fails naming the path when the marketplace has no catalog", async () => {
    const { useCase } = build({ marketplaces: [marketplace("one")], plugins: null });

    await expect(useCase.execute(command)).rejects.toThrow(
      new InvalidPluginManifestError('marketplace.json not found at "/cache/mkt"')
    );
  });
});
