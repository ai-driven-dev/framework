import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { GhCliAdapter } from "../../../../src/contexts/auth/infrastructure/gh-cli-adapter.js";
import { AuthenticationError } from "../../../../src/shared/domain/errors.js";

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
  it("reads the token through `gh auth token` within 3 s", () => {
    mockSpawnSync.mockReturnValue(answer({ stdout: "ghp_abc\n" }));

    new GhCliAdapter().read();

    expect(mockSpawnSync.mock.calls.at(-1)).toStrictEqual([
      "gh",
      ["auth", "token"],
      { timeout: 3000, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
    ]);
  });

  it("reads the login through `gh api user` within 5 s", async () => {
    mockSpawnSync.mockReturnValue(answer({ stdout: "octocat\n" }));

    await new GhCliAdapter().verify();

    expect(mockSpawnSync.mock.calls.at(-1)).toStrictEqual([
      "gh",
      ["api", "user", "--jq", ".login"],
      { timeout: 5000, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
    ]);
  });
});

describe("GhCliAdapter, resolving a token", () => {
  it("answers the token gh prints, trimmed", () => {
    mockSpawnSync.mockReturnValue(answer({ stdout: "ghp_abc123\n" }));

    expect(new GhCliAdapter().read()).toBe("ghp_abc123");
  });

  it("answers null when gh is absent", () => {
    mockSpawnSync.mockReturnValue(answer({ error: new Error("ENOENT"), status: null }));

    expect(new GhCliAdapter().read()).toBeNull();
  });

  it("answers null when gh prints nothing", () => {
    mockSpawnSync.mockReturnValue(answer({ stdout: "   " }));

    expect(new GhCliAdapter().read()).toBeNull();
  });
});

describe("GhCliAdapter, when gh fails", () => {
  it("names the exit code when gh wrote nothing", () => {
    mockSpawnSync.mockReturnValue(answer({ status: 1, stderr: "" }));

    expect(() => new GhCliAdapter().read()).toThrow("exited with code 1");
  });

  it("names the upgrade when gh lacks `auth token`", () => {
    mockSpawnSync.mockReturnValue(
      answer({ status: 1, stderr: 'unknown command "token" for "gh auth"' })
    );

    expect(() => new GhCliAdapter().read()).toThrow("gh CLI is too old to support");
  });

  it("copes with no stderr stream", () => {
    mockSpawnSync.mockReturnValue(answer({ status: 2, stderr: undefined }));

    expect(() => new GhCliAdapter().read()).toThrow("gh auth token exited with code 2");
  });

  it("says the code is unknown when gh left none", () => {
    mockSpawnSync.mockReturnValue(answer({ status: null, stderr: "" }));

    expect(() => new GhCliAdapter().read()).toThrow("gh auth token exited with code unknown");
  });

  it("names its stderr, trimmed", () => {
    mockSpawnSync.mockReturnValue(answer({ status: 1, stderr: "  boom  \n" }));

    expect(() => new GhCliAdapter().read()).toThrow("gh auth token failed: boom");
  });
});

describe("GhCliAdapter, verifying", () => {
  it("answers the login gh prints, trimmed", async () => {
    mockSpawnSync.mockReturnValue(answer({ stdout: "  octocat\n" }));

    expect(await new GhCliAdapter().verify()).toBe("octocat");
  });

  it.each([
    ["is absent", { error: new Error("ENOENT"), status: null, stdout: "octocat\n" }],
    ["exits non-zero", { status: 1, stderr: "not logged in", stdout: "octocat\n" }],
    ["prints an empty login", { stdout: "  \n" }],
  ])("refuses when gh %s", async (_situation, overrides) => {
    mockSpawnSync.mockReturnValue(answer(overrides));

    await expect(new GhCliAdapter().verify()).rejects.toThrow(new AuthenticationError("gh CLI"));
  });
});
