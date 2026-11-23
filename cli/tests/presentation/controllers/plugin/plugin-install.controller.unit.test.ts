import { Command } from "commander";
import { describe, expect, it, type Mock, vi } from "vitest";
import { bindOutput } from "../../../../src/presentation/controllers/menu/global-options.controller.js";
import { installPluginFrom } from "../../../../src/presentation/controllers/plugin/plugin-install.controller.js";
import { CapturingOutput } from "../../../shared/testing/capturing-output.fake.js";
import { syntheticCatalog } from "../../../shared/testing/synthetic-tool-id.builder.js";

function installation() {
  const install = vi.fn(async () => ({ kind: "marketplace", installed: ["aidd-dev"] }));
  const activation = vi.fn(async () => ({ binaryMissing: [], errors: [], failed: false }));
  const createDeps: Mock = vi.fn(async () => ({
    installPlugin: { execute: install },
    syncNativeActivation: { execute: activation },
  }));
  const output = new CapturingOutput();
  const program = new Command();
  bindOutput(program, () => output);
  return { install, activation, createDeps, output, program };
}

describe("installing a plugin from the command line", () => {
  it("installs what it was given, activates every marketplace, and names what landed", async () => {
    const { install, activation, createDeps, output, program } = installation();

    await installPluginFrom({ program, catalog: syntheticCatalog(), createDeps }, "aidd-dev", {});

    expect(install).toHaveBeenCalledWith(
      expect.objectContaining({ pluginArg: "aidd-dev", toolIds: "all", scope: undefined })
    );
    expect(activation).toHaveBeenCalledWith({
      projectRoot: process.cwd(),
      marketplaceNames: undefined,
    });
    expect(output.lines).toEqual(["Installed 'aidd-dev'."]);
  });

  it("narrows activation to the marketplace it was told to install from", async () => {
    const { activation, createDeps, program } = installation();

    await installPluginFrom({ program, catalog: syntheticCatalog(), createDeps }, "aidd-dev", {
      from: "market-b",
    });

    expect(activation).toHaveBeenCalledWith({
      projectRoot: process.cwd(),
      marketplaceNames: ["market-b"],
    });
  });
});
