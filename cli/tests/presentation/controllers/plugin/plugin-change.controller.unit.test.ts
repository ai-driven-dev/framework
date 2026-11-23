import { Command } from "commander";
import { describe, expect, it, type Mock, vi } from "vitest";
import { bindOutput } from "../../../../src/presentation/controllers/menu/global-options.controller.js";
import {
  removePluginFrom,
  updatePluginsFrom,
} from "../../../../src/presentation/controllers/plugin/plugin-change.controller.js";
import { CapturingOutput } from "../../../shared/testing/capturing-output.fake.js";
import { syntheticCatalog } from "../../../shared/testing/synthetic-tool-id.builder.js";

function change() {
  const remove = vi.fn(async () => undefined);
  const userRemove = vi.fn(async () => undefined);
  const update = vi.fn(async () => ["aidd-dev"]);
  const userUpdate = vi.fn(async () => ["aidd-vcs@aidd-framework"]);
  const activation = vi.fn(async () => ({ binaryMissing: [], errors: [], failed: false }));
  const containerOf: Mock = vi.fn(async () => ({
    plugin: {
      removePlugin: { execute: remove },
      userPluginRemove: { execute: userRemove },
      updatePlugin: { execute: update },
      updateUserPlugin: { execute: userUpdate },
    },
    marketplace: { syncNativeActivation: { execute: activation } },
  }));
  const output = new CapturingOutput();
  const program = new Command();
  bindOutput(program, () => output);
  const environment = { program, catalog: syntheticCatalog(), containerOf };
  return { remove, userRemove, update, userUpdate, activation, output, environment };
}

describe("removing a plugin from the command line", () => {
  it("removes at project scope by default, then re-drives activation", async () => {
    const { remove, userRemove, activation, output, environment } = change();

    await removePluginFrom(environment, "aidd-dev", {});

    expect(remove).toHaveBeenCalledOnce();
    expect(userRemove).not.toHaveBeenCalled();
    expect(activation).toHaveBeenCalledOnce();
    expect(output.lines).toEqual(["Plugin 'aidd-dev' removed."]);
  });

  it("sends a user-scope removal to the machine remover, without re-driving activation", async () => {
    const { remove, userRemove, activation, environment } = change();

    await removePluginFrom(environment, "aidd-dev", { scope: "user" });

    expect(userRemove).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    expect(activation).not.toHaveBeenCalled();
  });
});

describe("updating plugins from the command line", () => {
  it("updates every plugin at project scope when none is named", async () => {
    const { update, userUpdate, activation, environment } = change();

    await updatePluginsFrom(environment, undefined, {});

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ pluginNames: undefined, scope: "project" })
    );
    expect(userUpdate).not.toHaveBeenCalled();
    expect(activation).toHaveBeenCalledOnce();
  });

  it("sends a user-scope update to the machine updater, without re-driving activation", async () => {
    const { update, userUpdate, activation, environment } = change();

    await updatePluginsFrom(environment, "aidd-vcs", { scope: "user" });

    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ pluginNames: ["aidd-vcs"] }));
    expect(update).not.toHaveBeenCalled();
    expect(activation).not.toHaveBeenCalled();
  });
});
