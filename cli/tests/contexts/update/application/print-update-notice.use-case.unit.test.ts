import { describe, expect, it } from "vitest";
import { InMemoryUpdateCheckCache } from "../testing/in-memory-update-check-cache.fake.js";
import { aPrintUpdateNotice } from "../testing/update.builder.js";

describe("printing the update notice", () => {
  it("warns of a newer release the last check kept, however old the check", async () => {
    const useCase = aPrintUpdateNotice()
      .withCache(new InMemoryUpdateCheckCache({ checkedAt: 0, latest: "2.0.0" }))
      .build();

    expect(await useCase.execute()).toStrictEqual({
      notice: { current: "1.0.0", latest: "2.0.0" },
    });
  });

  it.each([
    ["nothing kept", null],
    ["something unreadable kept", "unreadable" as const],
    ["the installed version kept", { checkedAt: 0, latest: "1.0.0" }],
  ])("says nothing when %s", async (_label, kept) => {
    const useCase = aPrintUpdateNotice().withCache(new InMemoryUpdateCheckCache(kept)).build();

    expect(await useCase.execute()).toStrictEqual({ notice: null });
  });
});
