/**
 * A cache key that changes between two runs re-clones every time, and one two sources share
 * hands one plugin's tree to the other; a failure message must not carry the user's token.
 */
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const mockEnvFn = vi.fn().mockReturnThis();
const mockCloneFn = vi.fn().mockResolvedValue(undefined);
const mockRawFn = vi.fn().mockResolvedValue(undefined);
const mockCheckoutFn = vi.fn().mockResolvedValue(undefined);

const mockGitInstance = {
  env: mockEnvFn,
  clone: mockCloneFn,
  raw: mockRawFn,
  checkout: mockCheckoutFn,
};

const mockSimpleGit = vi.fn(() => mockGitInstance);

vi.mock("simple-git", () => ({
  simpleGit: (...args: unknown[]) => mockSimpleGit(...(args as [])),
}));

const mockExecFile = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
const mockAuthInput = vi.fn<(input: string) => void>();
const mockAuthSpawn = vi.fn<(cmd: string, args: string[], options: object) => void>();

vi.mock("node:child_process", () => ({
  execFile: (
    cmd: string,
    args: string[],
    optionsOrCallback:
      | object
      | ((err: unknown, result?: { stdout: string; stderr: string }) => void),
    callback?: (err: unknown) => void
  ) => {
    if (typeof optionsOrCallback !== "function") {
      mockAuthSpawn(cmd, args, optionsOrCallback);
      const stdin = {
        on: () => stdin,
        end: (input: string) => {
          mockAuthInput(input);
          const separator = args.lastIndexOf("--");
          const operation =
            args[1] === "clone"
              ? mockCloneFn(args[separator + 1], args[separator + 2], args.slice(2, separator))
              : Promise.resolve();
          operation.then(
            () => callback?.(null),
            (error: Error) => callback?.(error)
          );
        },
      };
      return { stdin };
    }
    try {
      mockExecFile(cmd, args);
      optionsOrCallback(null, { stdout: "", stderr: "" });
    } catch (err) {
      optionsOrCallback(err);
    }
    return undefined;
  },
}));

import { PluginFetcherAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-fetcher-adapter.js";
import { PluginFetchError } from "../../../../src/kernel/errors.js";
import type { PluginSource } from "../../../../src/kernel/source.js";
import type { TokenProvider } from "../../../../src/runtime/auth/ports/token-provider.js";
import { DeterministicHasher } from "../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";

const CACHE = "/tmp/cache";

function reset(): void {
  mockEnvFn.mockClear();
  mockCloneFn.mockClear().mockResolvedValue(undefined);
  mockRawFn.mockClear().mockResolvedValue(undefined);
  mockCheckoutFn.mockClear().mockResolvedValue(undefined);
  mockSimpleGit.mockClear();
  mockExecFile.mockClear().mockReturnValue(undefined);
  mockAuthInput.mockClear();
  mockAuthSpawn.mockClear();
}

let lastFs: InMemoryFileAdapter;

function adapter(token?: string, files: Record<string, string> = {}): PluginFetcherAdapter {
  reset();
  lastFs = new InMemoryFileAdapter(files, new DeterministicHasher());
  const provider: TokenProvider | undefined =
    token === undefined ? undefined : { resolve: async () => token };
  return new PluginFetcherAdapter(lastFs, provider);
}

function clonedInto(): string {
  return mockCloneFn.mock.calls[0]?.[1] as string;
}

/** The URL the clone was given; credentials must never appear there. */
function clonedFrom(): string {
  return mockCloneFn.mock.calls[0]?.[0] as string;
}

function authHeader(): string | undefined {
  const input = mockAuthInput.mock.calls[0]?.[0];
  return input
    ? (JSON.parse(input) as { GIT_CONFIG_VALUE_0?: string }).GIT_CONFIG_VALUE_0
    : undefined;
}

describe("where a fetched source lands in the cache", () => {
  describe("a github repo", () => {
    it("keys on owner, repo and ref, so two refs of one repo do not share a tree", async () => {
      const source: PluginSource = { kind: "github", repo: "acme/widgets", ref: "v2" };

      await adapter().fetch(source, CACHE);

      expect(clonedInto()).toBe(join(CACHE, "github-acme-widgets-v2"));
    });

    it("keys an unpinned repo on HEAD, not on an empty ref", async () => {
      await adapter().fetch({ kind: "github", repo: "acme/widgets" }, CACHE);

      expect(clonedInto()).toBe(join(CACHE, "github-acme-widgets-HEAD"));
    });

    it("is handed back from the cache instead of cloned a second time", async () => {
      const fetcher = adapter(undefined, {
        [`${CACHE}/github-acme-widgets-HEAD/plugin.json`]: "{}",
      });

      const result = await fetcher.fetch({ kind: "github", repo: "acme/widgets" }, CACHE);

      expect(mockCloneFn).not.toHaveBeenCalled();
      expect(result).toBe(join(CACHE, "github-acme-widgets-HEAD"));
    });
  });

  describe("a bare git url", () => {
    it("encodes the url and marks it HEAD when no ref is pinned", async () => {
      await adapter().fetch({ kind: "url", url: "https://example.com/repo.git" }, CACHE);

      expect(clonedInto()).toBe(join(CACHE, "https___example_com_repo_git-HEAD"));
    });

    it("appends the pinned ref, so a pin does not reuse the unpinned tree", async () => {
      await adapter().fetch({ kind: "url", url: "https://example.com/repo.git", ref: "v1" }, CACHE);

      expect(clonedInto()).toBe(join(CACHE, "https___example_com_repo_git-v1"));
    });

    it("truncates the key at 64 characters, the documented path-length guard", async () => {
      const long = `https://example.com/${"a".repeat(200)}.git`;

      await adapter().fetch({ kind: "url", url: long }, CACHE);

      const key = clonedInto().slice(CACHE.length + 1);
      expect(key, "64 encoded characters plus the -HEAD suffix").toBe(
        `${"https___example_com_".concat("a".repeat(44))}-HEAD`
      );
    });
  });

  describe("a subdirectory of a git repo", () => {
    it("keys on url, subpath and ref, and returns the subdirectory itself", async () => {
      const result = await adapter().fetch(
        {
          kind: "git-subdir",
          url: "https://example.com/mono.git",
          path: "packages/one",
          ref: "main",
        },
        CACHE
      );

      const dir = join(CACHE, "https___example_com_mono_git-subdir-packages_one-main");
      expect(clonedInto()).toBe(dir);
      expect(result, "the caller wants the subdirectory, not the clone root").toBe(
        join(dir, "packages", "one")
      );
    });
  });

  describe("a url the user typed their own credential into", () => {
    const url = "https://user:ghp_SECRET@example.com/private.git";

    it("keeps the credential out of the directory name written to disk", async () => {
      await adapter().fetch({ kind: "url", url }, CACHE);

      expect(clonedInto(), "a secret must not become a filename").not.toContain("ghp_SECRET");
      expect(clonedInto()).toBe(join(CACHE, "https___example_com_private_git-HEAD"));
    });

    it("passes credentials separately and leaves the cloned URL clean", async () => {
      await adapter().fetch({ kind: "url", url }, CACHE);

      expect(clonedFrom()).toBe("https://example.com/private.git");
      expect(authHeader()).toBe(
        `Authorization: Basic ${Buffer.from("user:ghp_SECRET").toString("base64")}`
      );
    });

    it("removes userinfo containing multiple at-signs before cloning", async () => {
      await adapter().fetch(
        { kind: "url", url: "https://user:pw@part@example.com/private.git" },
        CACHE
      );
      expect(clonedFrom()).toBe("https://example.com/private.git");
      expect(authHeader()).toBe(
        `Authorization: Basic ${Buffer.from("user:pw@part").toString("base64")}`
      );
    });
  });
});

describe("the token the CLI adds for the user", () => {
  it("passes the resolved token without putting it in the clone URL", async () => {
    await adapter("tok").fetch({ kind: "github", repo: "acme/widgets" }, CACHE);

    expect(clonedFrom()).toBe("https://github.com/acme/widgets.git");
    expect(authHeader()).toBe(
      `Authorization: Basic ${Buffer.from("x-access-token:tok").toString("base64")}`
    );
  });

  it("keeps authentication out of the parent process arguments and environment", async () => {
    const token = "synthetic-private-token";
    const encoded = Buffer.from(`x-access-token:${token}`).toString("base64");
    await adapter(token).fetch({ kind: "github", repo: "acme/widgets" }, CACHE);
    const spawned = JSON.stringify(mockAuthSpawn.mock.calls);
    expect(spawned).not.toContain(token);
    expect(spawned).not.toContain(encoded);
    expect(authHeader()).toContain(encoded);
  });

  it("does not treat an authenticated ref as a Git option", async () => {
    await expect(
      adapter("tok").fetch(
        { kind: "github", repo: "acme/widgets", ref: "--upload-pack=evil" },
        CACHE
      )
    ).rejects.toThrow(/Invalid Git reference/);
    expect(mockAuthSpawn).not.toHaveBeenCalled();
  });

  it("leaves an ssh url alone, where a token means nothing", async () => {
    await adapter("tok").fetch({ kind: "url", url: "git@example.com:acme/repo.git" }, CACHE);

    expect(clonedFrom()).toBe("git@example.com:acme/repo.git");
  });

  it("does not send a resolved token to an unrelated https host", async () => {
    await adapter("tok").fetch({ kind: "url", url: "https://example.com/private.git" }, CACHE);

    expect(clonedFrom()).toBe("https://example.com/private.git");
    expect(authHeader()).toBeUndefined();
  });

  it.each([
    "https://gitlab.com/group/private.git",
    "https://bitbucket.org/group/private.git",
    "https://github.com.attacker.example/private.git",
    "http://github.com/group/private.git",
  ])("never forwards an automatically resolved token to %s", async (url) => {
    await adapter("sensitive-token").fetch({ kind: "url", url }, CACHE);
    expect(authHeader()).toBeUndefined();
    expect(clonedFrom()).not.toContain("sensitive-token");
  });

  it("does not send a resolved token to an unrelated sparse repo", async () => {
    await adapter("tok").fetch(
      { kind: "git-subdir", url: "https://example.com/mono.git", path: "packages/one" },
      CACHE
    );

    expect(clonedFrom()).toBe("https://example.com/mono.git");
    expect(authHeader()).toBeUndefined();
  });

  it("clones unauthenticated when no provider is wired", async () => {
    await adapter().fetch({ kind: "url", url: "https://example.com/repo.git" }, CACHE);

    expect(clonedFrom()).toBe("https://example.com/repo.git");
  });
});

describe("how each kind of clone is asked for", () => {
  it("clones shallow, and asks for the branch only when one is pinned", async () => {
    await adapter().fetch({ kind: "github", repo: "acme/widgets", ref: "v2" }, CACHE);
    expect(mockCloneFn.mock.calls[0]?.[2]).toEqual(["--depth", "1", "--branch", "v2"]);

    await adapter().fetch({ kind: "github", repo: "acme/widgets" }, CACHE);
    expect(mockCloneFn.mock.calls[0]?.[2]).toEqual(["--depth", "1"]);
  });

  it("fetches a subdirectory without blobs, then narrows, then checks out", async () => {
    const fetcher = adapter();

    await fetcher.fetch(
      { kind: "git-subdir", url: "https://example.com/mono.git", path: "packages/one" },
      CACHE
    );

    expect(mockCloneFn.mock.calls[0]?.[2]).toEqual(["--filter=blob:none", "--no-checkout"]);
    expect(mockRawFn).toHaveBeenCalledWith(["sparse-checkout", "set", "packages/one"]);
    expect(mockCheckoutFn, "no ref pinned means HEAD").toHaveBeenCalledWith("HEAD");
  });

  it("checks out the pinned ref of a subdirectory source", async () => {
    await adapter().fetch(
      {
        kind: "git-subdir",
        url: "https://example.com/mono.git",
        path: "packages/one",
        ref: "release",
      },
      CACHE
    );

    expect(mockCheckoutFn).toHaveBeenCalledWith("release");
  });
});

describe("an npm package as a source", () => {
  it("asks for the pinned version", async () => {
    await adapter().fetch({ kind: "npm", package: "@acme/plugin", version: "1.2.3" }, CACHE);

    expect(mockExecFile).toHaveBeenCalledWith("pnpm", [
      "add",
      "--prefix",
      CACHE,
      "--",
      "@acme/plugin@1.2.3",
    ]);
  });

  it("falls back to latest when no version is pinned", async () => {
    await adapter().fetch({ kind: "npm", package: "@acme/plugin" }, CACHE);

    expect(mockExecFile.mock.calls[0]?.[1]?.at(-1)).toBe("@acme/plugin@latest");
  });

  it("names the spec it could not install", async () => {
    const fetcher = adapter();
    mockExecFile.mockImplementation(() => {
      throw new Error("ERR_PNPM_FETCH_404");
    });

    await expect(
      fetcher.fetch({ kind: "npm", package: "@acme/plugin", version: "9.9.9" }, CACHE)
    ).rejects.toThrow(/@acme\/plugin@9\.9\.9/);
  });
});

describe("what the user is told when a clone fails", () => {
  const url = "https://user:ghp_SECRET@example.com/private.git";

  it("does not print the credential the user typed", async () => {
    const fetcher = adapter();
    mockCloneFn.mockRejectedValue(new Error("fatal: repository not reachable"));

    await expect(fetcher.fetch({ kind: "url", url }, CACHE)).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("ghp_SECRET"),
      })
    );
  });

  it("does not print the token the CLI itself injected", async () => {
    const fetcher = adapter("injected-token");
    mockCloneFn.mockRejectedValue(
      new Error("fatal: could not clone https://x-access-token:injected-token@github.com/a/b.git")
    );

    await expect(fetcher.fetch({ kind: "github", repo: "acme/widgets" }, CACHE)).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("injected-token") })
    );
  });

  it("redacts an authentication header or token echoed by a failed Git process", async () => {
    const token = "test-only-token";
    const encoded = Buffer.from(`x-access-token:${token}`).toString("base64");
    const fetcher = adapter(token);
    mockCloneFn.mockRejectedValue(
      new Error(`remote echoed ${token} and Authorization: Basic ${encoded}`)
    );
    const message = await fetcher.fetch({ kind: "github", repo: "acme/widgets" }, CACHE).then(
      () => "unexpected success",
      (error: Error) => error.message
    );
    expect(message).not.toBe("unexpected success");
    expect(message).not.toContain(token);
    expect(message).not.toContain(encoded);
  });

  it("keeps the rest of git's message, so the failure is still diagnosable", async () => {
    const fetcher = adapter("injected-token");
    mockCloneFn.mockRejectedValue(
      new Error("fatal: could not clone https://x-access-token:injected-token@github.com/a/b.git")
    );

    await expect(fetcher.fetch({ kind: "github", repo: "acme/widgets" }, CACHE)).rejects.toThrow(
      "fatal: could not clone https://github.com/a/b.git"
    );
  });

  describe("when the remote refused the credentials", () => {
    it("tells an unrelated host user to configure Git credentials", async () => {
      const fetcher = adapter();
      mockCloneFn.mockRejectedValue(new Error("remote: Repository not found"));

      await expect(
        fetcher.fetch({ kind: "url", url: "https://example.com/private.git" }, CACHE)
      ).rejects.toThrow(/Git credential helper/);
    });

    it("tells a GitHub user how to supply a token", async () => {
      const fetcher = adapter();
      mockCloneFn.mockRejectedValue(new Error("remote: Repository not found"));
      await expect(fetcher.fetch({ kind: "github", repo: "acme/private" }, CACHE)).rejects.toThrow(
        /aidd auth login/
      );
    });

    it("tells an ssh user to check their key instead", async () => {
      const fetcher = adapter();
      mockCloneFn.mockRejectedValue(new Error("Permission denied (publickey)"));

      await expect(
        fetcher.fetch({ kind: "url", url: "git@example.com:acme/private.git" }, CACHE)
      ).rejects.toThrow(/SSH key/);
    });
  });

  it("reports an unrecognised failure as a clone failure, not an auth one", async () => {
    const fetcher = adapter();
    mockCloneFn.mockRejectedValue(new Error("fatal: unable to access: server hung up"));

    await expect(
      fetcher.fetch({ kind: "url", url: "https://example.com/repo.git" }, CACHE)
    ).rejects.toThrow(/git clone failed/);
  });
});

describe("a tree already in the cache", () => {
  const dir = join(CACHE, "https___example_com_mono_git-subdir-packages_one-HEAD");
  const source: PluginSource = {
    kind: "git-subdir",
    url: "https://example.com/mono.git",
    path: "packages/one",
  };

  it("surfaces a failure of the narrowing clone rather than swallowing it", async () => {
    const fetcher = adapter();
    mockCloneFn.mockRejectedValue(new Error("fatal: filter not supported"));

    await expect(fetcher.fetch(source, CACHE)).rejects.toThrow(PluginFetchError);
  });

  it("is handed back without cloning again", async () => {
    const fetcher = adapter(undefined, { [`${dir}/packages/one/plugin.json`]: "{}" });

    const result = await fetcher.fetch(source, CACHE);

    expect(mockCloneFn, "a cached tree is the whole point of the cache").not.toHaveBeenCalled();
    expect(result).toBe(join(dir, "packages", "one"));
  });

  it("is kept when the caller passes no options at all", async () => {
    const fetcher = adapter(undefined, { [`${dir}/packages/one/plugin.json`]: "{}" });

    await fetcher.fetch(source, CACHE);

    expect(mockCloneFn, "no options must not mean force-refresh").not.toHaveBeenCalled();
  });

  it("is thrown away and re-cloned when the caller forces a refresh", async () => {
    const fetcher = adapter(undefined, { [`${dir}/packages/one/plugin.json`]: "{}" });

    await fetcher.fetch(source, CACHE, { forceRefresh: true });

    expect(mockCloneFn).toHaveBeenCalledTimes(1);
  });
});

describe("an npm package already installed in the cache", () => {
  const source: PluginSource = { kind: "npm", package: "@acme/plugin" };
  const installed = { [`${CACHE}/node_modules/@acme/plugin/package.json`]: "{}" };

  it("is reinstalled from scratch when the caller forces a refresh", async () => {
    const fetcher = adapter(undefined, installed);

    const result = await fetcher.fetch(source, CACHE, { forceRefresh: true });

    expect(
      await lastFs.fileExists(`${CACHE}/node_modules/@acme/plugin/package.json`),
      "the stale install is wiped, not installed over"
    ).toBe(false);
    expect(result).toBe(join(CACHE, "node_modules", "@acme", "plugin"));
    expect(mockExecFile, "the reinstall still happens after the wipe").toHaveBeenCalledTimes(1);
  });

  it("is left in place when no refresh is asked for", async () => {
    const fetcher = adapter(undefined, installed);

    await fetcher.fetch(source, CACHE);

    expect(await lastFs.fileExists(`${CACHE}/node_modules/@acme/plugin/package.json`)).toBe(true);
  });
});

describe("a local path as a source", () => {
  it("names the path it resolved, not the one that was typed", async () => {
    const fetcher = adapter();

    await expect(fetcher.fetch({ kind: "local", path: "./missing" }, CACHE)).rejects.toThrow(
      PluginFetchError
    );
    await expect(fetcher.fetch({ kind: "local", path: "./missing" }, CACHE)).rejects.toThrow(
      new RegExp(process.cwd().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  });
});
