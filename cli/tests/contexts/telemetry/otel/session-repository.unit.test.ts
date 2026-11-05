import { describe, expect, it } from "vitest";
import { readSessionRepository } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/metadata/session-repository.js";

describe("Codex native session repository", () => {
  it.each([
    ["git@github.com:owner/repository.git", "https://github.com/owner/repository"],
    ["https://github.com/owner/repository", "https://github.com/owner/repository"],
    ["git@gitlab.com:group/subgroup/repo.git", "https://gitlab.com/group/subgroup/repo"],
    ["https://gitlab.com/group/repo.git", "https://gitlab.com/group/repo"],
  ])("publishes only the canonical supported identity for %s", async (originUrl, expected) => {
    const calls: Array<[string, object]> = [];
    const result = await readSessionRepository(async (method, params) => {
      calls.push([method, params]);
      return { thread: { id: "s", sessionId: "s", gitInfo: { originUrl } } };
    }, "s");
    expect(result).toEqual({ available: true, values: { "aidd.repository_url": expected } });
    expect(calls).toEqual([["thread/read", { threadId: "s", includeTurns: false }]]);
  });
  it.each([
    "https://user:secret@github.com/owner/repo.git",
    "https://github.com/owner/repo?token=secret",
    "https://github.com/owner/repo#fragment",
    "https://github.com:443/owner/repo",
    "https://example.com/owner/repo",
    "git@example.com:owner/repo",
    "ssh://git@github.com/owner/repo",
    "file:///owner/repo",
    "https://github.com/owner/repo%2fextra",
    "https://github.com/owner/../repo",
    "https://github.com/owner/.",
    "https://github.com/owner/repo/extra",
    "https://github.com/owner/.git",
    "https://github.com/owner/repo\n",
  ])(
    "clears a previous link without exposing an unsupported or unsafe remote %j",
    async (originUrl) => {
      expect(
        await readSessionRepository(
          async () => ({ thread: { id: "s", sessionId: "s", gitInfo: { originUrl } } }),
          "s"
        )
      ).toEqual({ available: true, values: {} });
    }
  );
  it("clears only an explicitly absent native Git origin", async () => {
    for (const gitInfo of [null, { originUrl: null }])
      expect(
        await readSessionRepository(
          async () => ({ thread: { id: "s", sessionId: "s", gitInfo } }),
          "s"
        )
      ).toEqual({ available: true, values: {} });
    for (const gitInfo of [undefined, {}])
      expect(
        await readSessionRepository(
          async () => ({ thread: { id: "s", sessionId: "s", gitInfo } }),
          "s"
        )
      ).toEqual({ available: false });
  });
  it.each([
    { id: "other", sessionId: "s", gitInfo: { originUrl: "git@github.com:a/b.git" } },
    { id: "s", sessionId: "other", gitInfo: { originUrl: "git@github.com:a/b.git" } },
  ])("rejects an unrelated thread", async (thread) => {
    expect(await readSessionRepository(async () => ({ thread }), "s")).toEqual({
      available: false,
    });
  });
  it("retains existing metadata on API errors", async () => {
    expect(
      await readSessionRepository(async () => {
        throw new Error("unavailable");
      }, "s")
    ).toEqual({ available: false });
  });
});
