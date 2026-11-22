import { describe, expect, it } from "vitest";
import { forEachCategory } from "../../../src/orchestration/global/for-each-category.js";

describe("forEachCategory", () => {
  it("runs ai then ide, one after the other, and returns each result", async () => {
    const order: string[] = [];

    const { results, errors } = await forEachCategory(async (category) => {
      order.push(`start ${category}`);
      await Promise.resolve();
      order.push(`end ${category}`);
      return category.toUpperCase();
    });

    expect(order).toStrictEqual(["start ai", "end ai", "start ide", "end ide"]);
    expect(results).toStrictEqual({ ai: "AI", ide: "IDE" });
    expect(errors).toStrictEqual([]);
  });

  it("collects a failing category as a scoped error and still runs the other", async () => {
    const boom = new Error("ai exploded");

    const { results, errors } = await forEachCategory(async (category) => {
      if (category === "ai") throw boom;
      return "fine";
    });

    expect(results).toStrictEqual({ ai: null, ide: "fine" });
    expect(errors).toStrictEqual([{ scope: "ai", error: boom }]);
  });

  it("lists errors in category order when both fail", async () => {
    const { results, errors } = await forEachCategory(async (category) => {
      throw new Error(category);
    });

    expect(results).toStrictEqual({ ai: null, ide: null });
    expect(errors).toStrictEqual([
      { scope: "ai", error: new Error("ai") },
      { scope: "ide", error: new Error("ide") },
    ]);
  });
});
