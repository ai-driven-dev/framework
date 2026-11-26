import { describe, expect, it } from "vitest";
import { forEachCategory } from "../../../src/orchestration/sync/for-each-category.js";
import { InputRequiredError } from "../../../src/shared/domain/shared.error.js";

describe("running a step per category", () => {
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

  it("stops at a category that needs a question nobody can answer", async () => {
    const ran: string[] = [];

    await expect(
      forEachCategory(async (category) => {
        ran.push(category);
        throw new InputRequiredError("use --force");
      })
    ).rejects.toThrow(InputRequiredError);

    expect(ran).toStrictEqual(["ai"]);
  });
});
