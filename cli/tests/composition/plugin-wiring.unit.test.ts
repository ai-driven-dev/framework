import { describe, expect, it, vi } from "vitest";
import { underMachineHome } from "../../src/composition/orchestration/plugin.js";

describe("the user-scope plugin removal the composition binds", () => {
  it("runs under the machine home it is given", async () => {
    const execute = vi.fn(async () => undefined);

    await underMachineHome({ execute }, "/sandbox/home").execute({
      pluginName: "aidd-dev",
      toolIds: "all",
      projectRoot: "/test-project",
    });

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      pluginName: "aidd-dev",
      toolIds: "all",
      projectRoot: "/test-project",
      home: "/sandbox/home",
    });
  });
});
