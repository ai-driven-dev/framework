import { describe, expect, it } from "vitest";
import type { BuiltMarketplaceEnsurer } from "../../../src/contexts/installation/contract/built-marketplace.js";
import { describeMessage } from "../../../src/presentation/errors/describe-message.presenter.js";
import {
  SYNTHETIC_NATIVE_TOOL,
  syntheticSyncCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { ActivatorFailingAtUpgrade, syncOf } from "../testing/sync-settings.builder.js";

/** The build runs for every tool, before the branch that decides who writes the registration
 * down, so a build that fails is on the path of every sync. */
const sync = syncOf(syntheticSyncCatalog(), SYNTHETIC_NATIVE_TOOL);

describe("a marketplace that will not build", () => {
  const failingBuild = (failFor: string): BuiltMarketplaceEnsurer => ({
    execute: async (options) => {
      if (options.marketplace.name === failFor) throw new Error("no catalog at that source");
      return { builtDir: `/built/${options.target}`, version: "test", rebuilt: true };
    },
  });

  it("says which marketplace and which tool were skipped", async () => {
    const { logger } = await sync({
      marketplaceNames: ["aidd-framework", "broken"],
      ensureBuilt: failingBuild("broken"),
    });

    expect(
      logger.warnMessages.some((w) => w.includes("'broken'") && w.includes(SYNTHETIC_NATIVE_TOOL)),
      "the warning must name the marketplace and the tool, or it says nothing actionable"
    ).toBe(true);
  });

  it("still syncs the tool, rather than letting one bad source stop the rest", async () => {
    const { written } = await sync({
      marketplaceNames: ["aidd-framework", "broken"],
      ensureBuilt: failingBuild("broken"),
    });

    expect(written?.enabledPlugins).toEqual({ "aidd-context@aidd-framework": true });
  });
});

/** Every known marketplace is registered whether or not a plugin was installed from it, so
 * one no plugin points at still needs its tree built or the registration points at nothing. */
describe("a marketplace no plugin points at", () => {
  it("is still built", async () => {
    const built: string[] = [];

    const recordingBuild: BuiltMarketplaceEnsurer = {
      execute: async (options) => {
        built.push(options.marketplace.name);
        return { builtDir: `/built/${options.target}`, version: "test", rebuilt: true };
      },
    };

    await sync({
      marketplaceNames: ["aidd-framework", "unused"],
      ensureBuilt: recordingBuild,
    });

    expect(built).toContain("unused");
  });
  it("is registered anyway, without a plugin attached to it", async () => {
    // Declaring a marketplace and installing a plugin from it are two acts, and a person does
    // the first alone all the time; measured, the real binary knew of neither registered one.
    const { activator } = await sync({
      marketplaceNames: ["aidd-framework", "unused"],
    });

    expect(activator.addedMarketplaces).toHaveLength(2);
  });
});

describe("what execute reports about activation", () => {
  it("names the tool whose CLI actually ran, in `activated`", async () => {
    const { result } = await sync();

    expect(result.activated).toEqual([SYNTHETIC_NATIVE_TOOL]);
    expect(result.failed, "no error was returned, so the run did not fail").toBe(false);
  });

  it("names the tool and the binary in `binaryMissing` when the CLI is not on PATH", async () => {
    const { result } = await sync({ available: false });

    expect(result.activated).toEqual([]);
    expect(result.binaryMissing).toEqual([
      { toolId: SYNTHETIC_NATIVE_TOOL, binary: SYNTHETIC_NATIVE_TOOL },
    ]);
  });

  it("collects a best-effort failure in `warnings`, the same content the logger gets", async () => {
    const { result, logger } = await sync({
      failOnPlugins: ["aidd-context@aidd-framework"],
    });

    const warnings = result.warnings.map(describeMessage);
    expect(warnings).toEqual(logger.warnMessages);
    expect(warnings.some((w) => w.includes("aidd-context@aidd-framework"))).toBe(true);
  });

  // A failure shape a real adapter never produces: activation must not swallow it as
  // best-effort, and the decision to throw belongs to whoever calls `execute`.
  it("carries a hard, unexpected activator failure in `errors` rather than throwing", async () => {
    const { result } = await sync({ crashOnAddMarketplace: true });

    expect(result.errors).toEqual([
      { scope: SYNTHETIC_NATIVE_TOOL, error: new Error("activator crashed adding a marketplace") },
    ]);
    expect(result.activated).toEqual([]);
    expect(result.failed, "one returned error fails the run").toBe(true);
  });
});

describe("what a step that could not complete leaves in warnings and errors", () => {
  it("names the binary in the warning when the CLI is not on PATH", async () => {
    const { logger, result } = await sync({ available: false });

    expect(logger.warnMessages).toStrictEqual([
      `${SYNTHETIC_NATIVE_TOOL} CLI not found on PATH — skipping native plugin activation.`,
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("names the plugin ref and the CLI's own reason when enabling it fails", async () => {
    const { result } = await sync({
      failOnPlugins: ["aidd-context@aidd-framework"],
    });

    expect(result.warnings).toStrictEqual([
      "Native plugin activation — enable plugin 'aidd-context@aidd-framework' skipped: plugin `aidd-context@aidd-framework` was not found in marketplace",
    ]);
  });

  it("warns about a refused marketplace upgrade and still enables the plugin", async () => {
    const activator = new ActivatorFailingAtUpgrade({ detail: "registry locked" });

    const { result } = await sync({ activator, ownedCatalog: true });

    expect(result.warnings).toStrictEqual([
      "Native plugin activation — upgrade marketplace 'aidd-framework' skipped: registry locked",
    ]);
    expect(result.errors).toStrictEqual([]);
    expect(activator.enabledPlugins).toStrictEqual(["aidd-context@aidd-framework"]);
  });

  it("reports an activator bug during the upgrade as an error, never as a warning", async () => {
    const activator = new ActivatorFailingAtUpgrade(new Error("activator bug"));

    const { result } = await sync({ activator, ownedCatalog: true });

    expect(result.errors).toStrictEqual([
      { scope: SYNTHETIC_NATIVE_TOOL, error: new Error("activator bug") },
    ]);
    expect(result.warnings).toStrictEqual([]);
  });
});
