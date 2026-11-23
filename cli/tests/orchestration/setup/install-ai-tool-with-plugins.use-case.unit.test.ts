import { describe, expect, it, vi } from "vitest";
import type { PluginToPropagate } from "../../../src/contexts/installation/application/install/install-ai-tool.use-case.js";
import {
  type ActivatePropagatedPlugins,
  InstallAiToolWithPlugins,
  type MarketplacePluginInstaller,
} from "../../../src/orchestration/setup/install-ai-tool-with-plugins.use-case.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { SYNTHETIC_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";

const PROJECT_ROOT = "/test-project";
const RUNTIME = { toolId: SYNTHETIC_TOOL, fileCount: 2, files: [], skipped: false, warnings: [] };
const REPORT = { activated: [], binaryMissing: [], warnings: [], errors: [], failed: false };

const named = (name: string): PluginToPropagate => ({
  name,
  version: "1.0.0",
  marketplace: "aidd",
});
const orphan = (name: string): PluginToPropagate => ({
  name,
  version: "1.0.0",
  marketplace: undefined,
});

function setup(
  plugins: readonly PluginToPropagate[],
  install: MarketplacePluginInstaller["execute"] = async () => undefined,
  activate: ActivatePropagatedPlugins["execute"] = async () => REPORT
) {
  const logger = new CapturingLogger();
  const order: string[] = [];
  const pluginInstall = vi.fn<MarketplacePluginInstaller["execute"]>(async (request) => {
    order.push(`install ${request.pluginName}`);
    return install(request);
  });
  const activatePropagated = vi.fn<ActivatePropagatedPlugins["execute"]>(async (request) => {
    order.push("activate");
    return activate(request);
  });
  const useCase = new InstallAiToolWithPlugins({
    installAiTool: {
      execute: async () => {
        order.push("runtime");
        return { runtimeResult: RUNTIME, pluginsToPropagate: plugins };
      },
    },
    pluginInstallFromMarketplace: { execute: pluginInstall },
    activatePropagated: { execute: activatePropagated },
    logger,
  });
  const run = () =>
    useCase.execute({
      toolId: SYNTHETIC_TOOL,
      projectRoot: PROJECT_ROOT,
      force: false,
      version: "1.0.0",
      propagatePlugins: true,
    });
  return { run, pluginInstall, activatePropagated, logger, order };
}

describe("installing an AI tool with its plugins", () => {
  it("installs the tool, then each plugin, then activates once", async () => {
    const { run, order, pluginInstall } = setup([named("a"), named("b")]);

    const result = await run();

    expect(order).toEqual(["runtime", "install a", "install b", "activate"]);
    expect(pluginInstall).toHaveBeenCalledWith({
      pluginName: "a",
      version: "1.0.0",
      fromMarketplace: "aidd",
      toolIds: [SYNTHETIC_TOOL],
      projectRoot: PROJECT_ROOT,
      interactive: false,
      autoSelect: true,
      replace: true,
      requestedVersionPolicy: "prefer-catalog",
    });
    expect(result).toEqual({
      runtimeResult: RUNTIME,
      propagatedPlugins: ["a", "b"],
      propagationWarnings: [],
      activation: REPORT,
    });
  });

  it("activates nothing when no plugin was propagated", async () => {
    const { run, activatePropagated } = setup([]);

    const result = await run();

    expect(activatePropagated).not.toHaveBeenCalled();
    expect(result.activation).toBeUndefined();
  });

  it("surfaces the activation's own errors in its result", async () => {
    const error = { scope: SYNTHETIC_TOOL, error: "different catalog" };
    const { run } = setup([named("a")], undefined, async () => ({ ...REPORT, errors: [error] }));

    expect((await run()).activation?.errors).toEqual([error]);
  });

  it("warns and skips a plugin with no marketplace, still propagating the others", async () => {
    const { run, pluginInstall, logger } = setup([orphan("lost"), named("ok")]);

    const result = await run();

    const text = `Plugin 'lost' has no marketplace — cannot propagate to ${SYNTHETIC_TOOL}. Add it manually.`;
    expect(result.propagationWarnings).toEqual([{ text }]);
    expect(result.propagatedPlugins).toEqual(["ok"]);
    expect(pluginInstall).toHaveBeenCalledOnce();
    expect(logger.warnMessages).toEqual([text]);
  });

  it("warns with the failure and carries on when a plugin cannot be installed", async () => {
    const failure = new Error("catalog unavailable");
    const { run, logger, order } = setup([named("bad"), named("ok")], async (request) => {
      if (request.pluginName === "bad") throw failure;
    });

    const result = await run();

    const text = `Plugin 'bad' could not be propagated to ${SYNTHETIC_TOOL}: `;
    expect(result.propagationWarnings).toEqual([{ text, cause: failure }]);
    expect(result.propagatedPlugins).toEqual(["ok"]);
    expect(logger.warnMessages).toEqual([`${text}catalog unavailable`]);
    expect(order).toEqual(["runtime", "install bad", "install ok", "activate"]);
  });

  it("activates nothing when every plugin failed", async () => {
    const { run, activatePropagated } = setup([named("bad")], async () => {
      throw new Error("down");
    });

    await run();

    expect(activatePropagated).not.toHaveBeenCalled();
  });
});
