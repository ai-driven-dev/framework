import { beforeEach, describe, expect, it, vi } from "vitest";

const clone = vi.fn();
const raw = vi.fn();
const checkout = vi.fn();
const git = { env: vi.fn().mockReturnThis(), clone, raw, checkout };

vi.mock("simple-git", () => ({ simpleGit: vi.fn(() => git) }));

import { PluginFetchError } from "../../../../src/contexts/distribution/domain/distribution.error.js";
import { GitCloner } from "../../../../src/contexts/distribution/infrastructure/git-cloner-adapter.js";

const REQUEST = {
  authUrl: "https://token@github.com/acme/repo.git",
  displayUrl: "https://github.com/acme/repo.git",
  targetDir: "/cache/repo",
};

describe("cloning a repository", () => {
  beforeEach(() => {
    clone.mockReset().mockResolvedValue(undefined);
    raw.mockReset().mockResolvedValue(undefined);
    checkout.mockReset().mockResolvedValue(undefined);
  });

  it("clones one commit deep, on the ref when there is one", async () => {
    await new GitCloner().cloneShallow({ ...REQUEST, ref: "v1" });

    expect(clone).toHaveBeenCalledWith(REQUEST.authUrl, REQUEST.targetDir, [
      "--depth",
      "1",
      "--branch",
      "v1",
    ]);
  });

  it("clones without blobs, then checks out only the subpath", async () => {
    await new GitCloner().cloneSparse(REQUEST, "packages/one");

    expect(clone).toHaveBeenCalledWith(REQUEST.authUrl, REQUEST.targetDir, [
      "--filter=blob:none",
      "--no-checkout",
    ]);
    expect(raw).toHaveBeenCalledWith(["sparse-checkout", "set", "packages/one"]);
    expect(checkout).toHaveBeenCalledWith("HEAD");
  });

  it("names an authentication failure without the credential the clone ran with", async () => {
    clone.mockRejectedValue(new Error("Authentication failed for https://token@github.com/x"));

    const failure = await failureOf(() => new GitCloner().cloneShallow(REQUEST));

    expect(failure.detail).toContain("Authentication failed");
    expect(failure.detail).not.toContain("token@");
  });

  it("scrubs the credential from any other clone failure", async () => {
    clone.mockRejectedValue(new Error("fatal: https://token@github.com/x unreachable"));

    const failure = await failureOf(() => new GitCloner().cloneShallow(REQUEST));

    expect(failure.detail).toContain("git clone failed");
    expect(failure.detail).not.toContain("token@");
  });
});

async function failureOf(run: () => Promise<void>): Promise<PluginFetchError> {
  try {
    await run();
  } catch (err) {
    if (err instanceof PluginFetchError) return err;
    throw err;
  }
  throw new Error("the clone did not fail");
}
