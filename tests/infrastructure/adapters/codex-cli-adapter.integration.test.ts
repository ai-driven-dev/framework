import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { CodexCliError } from "../../../src/domain/errors.js";
import { CodexCliAdapter } from "../../../src/infrastructure/adapters/codex-cli-adapter.js";

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

describe("CodexCliAdapter", () => {
  it("reports availability when `codex --version` exits 0", () => {
    mockSpawnSync.mockReturnValue(makeResult({ stdout: "codex-cli 0.136.0" }));

    expect(new CodexCliAdapter().isAvailable()).toBe(true);
    expect(mockSpawnSync).toHaveBeenCalledWith("codex", ["--version"], expect.anything());
  });

  it("reports unavailable when the codex binary is missing (ENOENT)", () => {
    mockSpawnSync.mockReturnValue(makeResult({ error: new Error("ENOENT"), status: null }));

    expect(new CodexCliAdapter().isAvailable()).toBe(false);
  });

  it("registers a marketplace via `codex plugin marketplace add <source>`", () => {
    mockSpawnSync.mockReturnValue(makeResult({}));

    new CodexCliAdapter().addMarketplace("/abs/mkt");

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "codex",
      ["plugin", "marketplace", "add", "/abs/mkt"],
      expect.anything()
    );
  });

  it("upgrades marketplaces via `codex plugin marketplace upgrade`", () => {
    mockSpawnSync.mockReturnValue(makeResult({}));

    new CodexCliAdapter().upgradeMarketplaces();

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "codex",
      ["plugin", "marketplace", "upgrade"],
      expect.anything()
    );
  });

  it("enables a plugin via `codex plugin add <ref>`", () => {
    mockSpawnSync.mockReturnValue(makeResult({}));

    new CodexCliAdapter().enablePlugin("aidd-context@aidd-framework");

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "codex",
      ["plugin", "add", "aidd-context@aidd-framework"],
      expect.anything()
    );
  });

  it("throws CodexCliError with stderr detail on non-zero exit", () => {
    mockSpawnSync.mockReturnValue(
      makeResult({ status: 1, stderr: "plugin `ghost` was not found in marketplace `m1`" })
    );

    expect(() => new CodexCliAdapter().enablePlugin("ghost@m1")).toThrow(CodexCliError);
    expect(() => new CodexCliAdapter().enablePlugin("ghost@m1")).toThrow(
      "plugin `ghost` was not found"
    );
  });

  it("throws CodexCliError when the process fails to spawn", () => {
    mockSpawnSync.mockReturnValue(makeResult({ error: new Error("spawn EACCES"), status: null }));

    expect(() => new CodexCliAdapter().addMarketplace("/abs/mkt")).toThrow(CodexCliError);
  });
});
