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

  function listing(stdout: string, status = 0) {
    mockSpawnSync.mockReset();
    mockSpawnSync.mockImplementation((_binary, args) =>
      (args as string[])[1] === "list" ? makeResult({ stdout, status }) : makeResult({})
    );
  }

  const removeArgs = () => mockSpawnSync.mock.calls.at(-1)?.[1];

  it("names no scope when no project uses it, from the home directory, so the registration goes too", () => {
    listing('[{"id":"aidd-dev@aidd-framework","scope":"user"},{"id":"x@other","scope":"local"}]');

    adapter().removeMarketplace("aidd-framework", "user");

    expect(mockSpawnSync).toHaveBeenLastCalledWith(
      "claude",
      ["plugin", "marketplace", "remove", "aidd-framework"],
      expect.objectContaining({ cwd: homedir() })
    );
  });

  it("stays at user scope when a project installed from it, so that project keeps its plugins", () => {
    listing('[{"id":"aidd-dev@aidd-framework","scope":"local","projectPath":"/p"}]');

    adapter().removeMarketplace("aidd-framework", "user");

    expect(removeArgs()).toEqual([
      "plugin",
      "marketplace",
      "remove",
      "aidd-framework",
      "--scope",
      "user",
    ]);
  });

  it.each([
    ["fails", "", 1],
    ["answers no JSON", "not json", 0],
  ])("stays at user scope when the list %s, never the wider removal", (_case, stdout, status) => {
    listing(stdout, status);

    adapter().removeMarketplace("aidd-framework", "user");

    expect(removeArgs()).toEqual([
      "plugin",
      "marketplace",
      "remove",
      "aidd-framework",
      "--scope",
      "user",
    ]);
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
