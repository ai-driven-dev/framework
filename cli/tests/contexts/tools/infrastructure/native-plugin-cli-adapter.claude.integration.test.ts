import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { NativePluginCliAdapter } from "../../../../src/contexts/tools/infrastructure/native-plugin-cli-adapter.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const mockSpawnSync = vi.mocked(spawnSync);

function makeResult(overrides: Partial<ReturnType<typeof spawnSync>>) {
  return {
    pid: 1,
    output: [],
    stdout: "",
    stderr: "",
    status: 0,
    signal: null,
    error: undefined,
    ...overrides,
  } as ReturnType<typeof spawnSync>;
}

// Claude is the one profile that declares `scopeArgs`; codex and copilot declare none and get
// nothing appended whatever is passed, which is why neither carries a test like this one.
function claudeAdapter(): NativePluginCliAdapter {
  return new NativePluginCliAdapter("claude", {
    scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
    enableVerb: "install",
    disableVerb: "uninstall",
  });
}

describe("ClaudeCliAdapter — plugin enable/uninstall carry the requested scope", () => {
  it("enables a plugin at project scope by default — --scope local, never claude's own implicit default", () => {
    mockSpawnSync.mockReturnValue(makeResult({}));

    claudeAdapter().enablePlugin("aidd-context@aidd-framework");

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "claude",
      ["plugin", "install", "aidd-context@aidd-framework", "--scope", "local"],
      expect.anything()
    );
  });

  it("enables a plugin at user scope when asked", () => {
    mockSpawnSync.mockReturnValue(makeResult({}));

    claudeAdapter().enablePlugin("aidd-context@aidd-framework", "user");

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "claude",
      ["plugin", "install", "aidd-context@aidd-framework", "--scope", "user"],
      expect.anything()
    );
  });

  it("uninstalls a plugin at project scope by default", () => {
    mockSpawnSync.mockReturnValue(makeResult({}));

    claudeAdapter().uninstallPlugin("aidd-context@aidd-framework");

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "claude",
      ["plugin", "uninstall", "aidd-context@aidd-framework", "--scope", "local"],
      expect.anything()
    );
  });

  it("uninstalls a plugin at user scope when asked", () => {
    mockSpawnSync.mockReturnValue(makeResult({}));

    claudeAdapter().uninstallPlugin("aidd-context@aidd-framework", "user");

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "claude",
      ["plugin", "uninstall", "aidd-context@aidd-framework", "--scope", "user"],
      expect.anything()
    );
  });
});

describe("ClaudeCliAdapter — removing a user-scope marketplace deletes its registration", () => {
  const adapter = () =>
    new NativePluginCliAdapter("claude", {
      scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
      userRemoveArgs: [],
    });

  it("names no scope at user scope, from the home directory, so the registration goes too", () => {
    mockSpawnSync.mockReturnValue(makeResult({}));

    adapter().removeMarketplace("aidd-framework", "user");

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "claude",
      ["plugin", "marketplace", "remove", "aidd-framework"],
      expect.objectContaining({ cwd: homedir() })
    );
  });

  it("keeps the project scope's own arguments, from the current directory", () => {
    mockSpawnSync.mockReturnValue(makeResult({}));

    adapter().removeMarketplace("aidd-framework", "project");

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "claude",
      ["plugin", "marketplace", "remove", "aidd-framework", "--scope", "local"],
      expect.not.objectContaining({ cwd: expect.anything() })
    );
  });
});
