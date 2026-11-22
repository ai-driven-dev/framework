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
import { PluginFetcherAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-fetcher-adapter.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { FakeNpmInstaller } from "../testing/npm-installer.fake.js";

function makeAdapter(): PluginFetcherAdapter {
  const fs = new InMemoryFileAdapter({});
  return new PluginFetcherAdapter(fs, new GitCloner(), new FakeNpmInstaller(fs, []));
}

describe("PluginFetcherAdapter - fail-fast git clone", () => {
  it("sets GIT_TERMINAL_PROMPT=0 on every clone to prevent interactive credential prompts", async () => {
    const adapter = makeAdapter();

    await adapter.fetch({ kind: "url", url: "https://example.com/repo.git" }, "/tmp/cache");

    expect(mockEnvFn).toHaveBeenCalledWith("GIT_TERMINAL_PROMPT", "0");
  });
});
