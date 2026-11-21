import { Command } from "commander";
import { describe, expect, it, type Mock, vi } from "vitest";
import { bindOutput } from "../../../src/presentation/controllers/global-options.controller.js";
import {
  removePluginFrom,
  updatePluginsFrom,
} from "../../../src/presentation/controllers/plugin-change.controller.js";
import { CapturingOutput } from "../../shared/testing/capturing-output.fake.js";
import { catalogOf } from "../../shared/testing/catalog-of.builder.js";

function change() {
  const remove = vi.fn(async () => undefined);
  const userRemove = vi.fn(async () => undefined);
  const update = vi.fn(async () => ["aidd-dev"]);
  const userUpdate = vi.fn(async () => ["aidd-vcs@aidd-framework"]);
  const activation = vi.fn(async () => ({ binaryMissing: [], errors: [], failed: false }));
  const createDeps: Mock = vi.fn(async () => ({
    pluginRemoveUseCase: { execute: remove },
    userPluginRemove: { execute: userRemove },
    pluginUpdateUseCase: { execute: update },
    userPluginUpdateUseCase: { execute: userUpdate },
    syncNativeActivation: { execute: activation },
  }));
  const output = new CapturingOutput();
  const program = new Command();
  bindOutput(program, () => output);
  const environment = { program, catalog: catalogOf(), createDeps };
  return { remove, userRemove, update, userUpdate, activation, output, environment };
}

describe("removePluginFrom", () => {
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

describe("updatePluginsFrom", () => {
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
