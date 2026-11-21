import { describe, expect, it, vi } from "vitest";
import type { PluginSourceMatch } from "../../../src/contexts/distribution/contract/plugin-source-match.js";
import type { PluginAddOptions } from "../../../src/contexts/installation/application/plugin/add-plugin.js";
import {
  InstallFromMarketplace,
  type PluginInstallFromMarketplaceOptions,
} from "../../../src/orchestration/plugin/install-from-marketplace.js";
import { VersionMismatchError } from "../../../src/shared/domain/errors.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { ChoosingPrompter } from "../../shared/testing/choosing-prompter.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

function match(marketplaceName: string, version?: string, github = false): PluginSourceMatch {
  return {
    marketplaceName,
    githubMarketplace: github,
    entry: {
      name: "alpha",
      source: { kind: "local", path: "/alpha" },
      version,
      recommended: false,
      strict: true,
    },
    source: { kind: "local", path: `/${marketplaceName}/alpha` },
  };
}

const request: PluginInstallFromMarketplaceOptions = {
  pluginName: "alpha",
  toolIds: [TOOL.claude],
  projectRoot: "/project",
  interactive: true,
};

function build(matches: PluginSourceMatch[], chosenName = "") {
  const added: PluginAddOptions[] = [];
  const logger = new CapturingLogger();
  const resolve = vi.fn(async () => matches);
  const useCase = new InstallFromMarketplace(
    { execute: resolve },
    {
      execute: async (command) => {
        added.push(command);
      },
    },
    new ChoosingPrompter(chosenName),
    logger
  );
  return { useCase, added, logger, resolve };
}

describe("InstallFromMarketplace", () => {
  it("adds the plugin from the one marketplace that lists it, with its catalog metadata", async () => {
    const { useCase, added, resolve } = build([match("one", "1.0.0", true)]);

    const result = await useCase.execute({
      ...request,
      fromMarketplace: "one",
      replace: true,
    });

    expect(resolve).toHaveBeenCalledWith({
      pluginName: "alpha",
      projectRoot: "/project",
      fromMarketplace: "one",
    });
    expect(result.marketplaceName).toBe("one");
    expect(added).toEqual([
      {
        source: { kind: "local", path: "/one/alpha" },
        toolIds: [TOOL.claude],
        projectRoot: "/project",
        interactive: true,
        marketplace: "one",
        githubMarketplace: true,
        requiredVersion: undefined,
        pluginMetadata: { name: "alpha", version: "1.0.0", strict: true },
        replace: true,
      },
    ]);
  });

  it("adds from the marketplace the user picks when several list the plugin", async () => {
    const { useCase, added } = build([match("one", "1.0.0"), match("two", "2.0.0")], "two — 2.0.0");

    const result = await useCase.execute(request);

    expect(result.marketplaceName).toBe("two");
    expect(added[0].marketplace).toBe("two");
  });

  it("requires the requested version when the catalog agrees", async () => {
    const { useCase, added } = build([match("one", "1.0.0")]);

    await useCase.execute({ ...request, version: "1.0.0" });

    expect(added[0].requiredVersion).toBe("1.0.0");
  });

  it("refuses a requested version the catalog does not list, adding nothing", async () => {
    const { useCase, added } = build([match("one", "1.0.0")]);

    await expect(useCase.execute({ ...request, version: "2.0.0" })).rejects.toThrow(
      VersionMismatchError
    );
    expect(added).toEqual([]);
  });

  it("takes the catalog version and says so when the policy prefers the catalog", async () => {
    const { useCase, added, logger } = build([match("one", "1.0.0")]);

    await useCase.execute({
      ...request,
      version: "2.0.0",
      requestedVersionPolicy: "prefer-catalog",
    });

    expect(added[0].requiredVersion).toBeUndefined();
    expect(logger.infoMessages).toEqual([
      "Plugin 'alpha': catalog version 1.0.0 differs from requested 2.0.0; using catalog version.",
    ]);
  });

  it("stays silent when the policy prefers the catalog and the versions agree", async () => {
    const { useCase, logger } = build([match("one", "1.0.0")]);

    await useCase.execute({
      ...request,
      version: "1.0.0",
      requestedVersionPolicy: "prefer-catalog",
    });

    expect(logger.infoMessages).toEqual([]);
  });
});
