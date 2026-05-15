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

import { PluginFetcherAdapter } from "../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import { DeterministicHasher } from "../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";

function makeAdapter(): PluginFetcherAdapter {
  const fs = new InMemoryFileAdapter({}, new DeterministicHasher());
  return new PluginFetcherAdapter(fs);
}

describe("PluginFetcherAdapter — fail-fast git clone", () => {
  it("sets GIT_TERMINAL_PROMPT=0 on every clone to prevent interactive credential prompts", async () => {
    const adapter = makeAdapter();

    await adapter.fetch({ kind: "url", url: "https://example.com/repo.git" }, "/tmp/cache");

    expect(mockEnvFn).toHaveBeenCalledWith("GIT_TERMINAL_PROMPT", "0");
  });
});
