import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "../../../src/kernel/errors.js";
import { GhCliAdapter } from "../../../src/runtime/auth/gh-cli-adapter.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const mockSpawnSync = vi.mocked(spawnSync);

function answer(overrides: Partial<ReturnType<typeof spawnSync>>): ReturnType<typeof spawnSync> {
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

describe("GhCliAdapter, the commands it runs", () => {
  it("reads the token through `gh auth token`, with a bounded wait", () => {
    mockSpawnSync.mockReturnValue(answer({ stdout: "ghp_abc\n" }));

    new GhCliAdapter().resolve();

    expect(mockSpawnSync.mock.calls.at(-1)).toStrictEqual([
      "gh",
      ["auth", "token"],
      { timeout: 3000, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
    ]);
  });

  it("names the login through `gh api user`, with a bounded wait", async () => {
    mockSpawnSync.mockReturnValue(answer({ stdout: "octocat\n" }));

    await new GhCliAdapter().verify();

    expect(mockSpawnSync.mock.calls.at(-1)).toStrictEqual([
      "gh",
      ["api", "user", "--jq", ".login"],
      { timeout: 5000, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
    ]);
  });
});

describe("GhCliAdapter.verify", () => {
  it("answers the login gh prints, trimmed", async () => {
    mockSpawnSync.mockReturnValue(answer({ stdout: "  octocat\n" }));

    expect(await new GhCliAdapter().verify()).toBe("octocat");
  });

  it("refuses when gh is not installed", async () => {
    mockSpawnSync.mockReturnValue(
      answer({ error: new Error("ENOENT"), status: null, stdout: "octocat\n" })
    );

    await expect(new GhCliAdapter().verify()).rejects.toThrow(new AuthenticationError("gh CLI"));
  });

  it("refuses when gh exits non-zero", async () => {
    mockSpawnSync.mockReturnValue(
      answer({ status: 1, stderr: "not logged in", stdout: "octocat\n" })
    );

    await expect(new GhCliAdapter().verify()).rejects.toThrow(new AuthenticationError("gh CLI"));
  });

  it("refuses an empty login", async () => {
    mockSpawnSync.mockReturnValue(answer({ stdout: "  \n" }));

    await expect(new GhCliAdapter().verify()).rejects.toThrow(new AuthenticationError("gh CLI"));
  });
});

describe("GhCliAdapter.resolve, reading stderr", () => {
  it("copes with gh answering no stderr stream at all", () => {
    mockSpawnSync.mockReturnValue(answer({ status: 2, stderr: undefined }));

    expect(() => new GhCliAdapter().resolve()).toThrow("gh auth token exited with code 2");
  });

  it("says the exit code is unknown when gh left none", () => {
    mockSpawnSync.mockReturnValue(answer({ status: null, stderr: "" }));

    expect(() => new GhCliAdapter().resolve()).toThrow("gh auth token exited with code unknown");
  });

  it("trims the stderr it reports", () => {
    mockSpawnSync.mockReturnValue(answer({ status: 1, stderr: "  boom  \n" }));

    expect(() => new GhCliAdapter().resolve()).toThrow("gh auth token failed: boom");
  });
});
