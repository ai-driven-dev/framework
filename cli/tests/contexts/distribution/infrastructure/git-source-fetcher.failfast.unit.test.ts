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

vi.mock("simple-git", () => ({
  simpleGit: vi.fn(() => mockGitInstance),
}));

import { GitCloner } from "../../../../src/contexts/distribution/infrastructure/git-cloner-adapter.js";
import { GitSourceFetcher } from "../../../../src/contexts/distribution/infrastructure/git-source-fetcher.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";

function makeFetcher(): GitSourceFetcher {
  return new GitSourceFetcher(new InMemoryFileAdapter({}), new GitCloner());
}

describe("GitSourceFetcher - fail-fast git clone", () => {
  it("sets GIT_TERMINAL_PROMPT=0 on every clone to prevent interactive credential prompts", async () => {
    const adapter = makeFetcher();

    await adapter.fetch({ kind: "url", url: "https://example.com/repo.git" }, "/tmp/cache");

    expect(mockEnvFn).toHaveBeenCalledWith("GIT_TERMINAL_PROMPT", "0");
  });
});
