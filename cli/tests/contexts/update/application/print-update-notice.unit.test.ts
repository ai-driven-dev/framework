import { describe, expect, it } from "vitest";
import { InMemoryUpdateCheckCache } from "../testing/in-memory-update-check-cache.js";
import { aPrintUpdateNotice } from "../testing/update-builders.js";

describe("PrintUpdateNotice", () => {
  it("warns of a newer release the last check kept, however old the check", async () => {
    const { useCase, logger } = aPrintUpdateNotice()
      .withCache(new InMemoryUpdateCheckCache({ checkedAt: 0, latest: "2.0.0" }))
      .build();

    await useCase.execute();

    expect(logger.warnMessages).toStrictEqual([
      "CLI update available: v1.0.0 → v2.0.0",
      "Run `aidd update`.",
    ]);
  });

  it.each([
    ["nothing kept", null],
    ["something unreadable kept", "unreadable" as const],
    ["the installed version kept", { checkedAt: 0, latest: "1.0.0" }],
  ])("says nothing when %s", async (_label, kept) => {
    const { useCase, logger } = aPrintUpdateNotice()
      .withCache(new InMemoryUpdateCheckCache(kept))
      .build();

    await useCase.execute();

    expect(logger.warnMessages).toStrictEqual([]);
  });
});
