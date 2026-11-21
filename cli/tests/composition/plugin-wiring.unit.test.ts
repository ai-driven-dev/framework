import { afterEach, describe, expect, it, vi } from "vitest";
import { underMachineHome } from "../../src/composition/orchestration/plugin.js";

// The operating system reports a home other than the one HOME names, as a Windows session does.
vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  homedir: () => "/os/home",
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the user-scope plugin removal the composition binds", () => {
  it("runs under the machine home the environment names, not the one the operating system reports", async () => {
    vi.stubEnv("HOME", "/sandbox/home");
    const execute = vi.fn(async () => undefined);

    await underMachineHome({ execute }).execute({
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
