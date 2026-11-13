import { describe, expect, it } from "vitest";
import { FrameworkResolutionError } from "../../../../src/kernel/errors.js";
import { FakeCliReleaseSource } from "../testing/fake-cli-release-source.js";
import { InMemoryUpdateCheckCache } from "../testing/in-memory-update-check-cache.js";
import { aRefreshUpdateCheck } from "../testing/update-builders.js";

describe("RefreshUpdateCheck", () => {
  it("keeps the latest version with the time it was asked", async () => {
    const cache = new InMemoryUpdateCheckCache();

    const kept = await aRefreshUpdateCheck().withCache(cache).build().execute();

    expect(kept).toStrictEqual({ checkedAt: 1000, latest: "2.0.0" });
    expect(await cache.read()).toStrictEqual(kept);
  });

  it("keeps nothing new when the release cannot be read", async () => {
    const cache = new InMemoryUpdateCheckCache({ checkedAt: 1, latest: "1.5.0" });
    const useCase = aRefreshUpdateCheck()
      .withCache(cache)
      .withReleases(new FakeCliReleaseSource(new FrameworkResolutionError("offline")))
      .build();

    await expect(useCase.execute()).rejects.toBeInstanceOf(FrameworkResolutionError);
    expect(await cache.read()).toStrictEqual({ checkedAt: 1, latest: "1.5.0" });
  });
});
