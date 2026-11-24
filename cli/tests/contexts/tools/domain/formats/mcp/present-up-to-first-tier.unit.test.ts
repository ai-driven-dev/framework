import { describe, expect, it } from "vitest";
import { presentUpToFirstTier } from "../../../../../../src/contexts/tools/domain/formats/mcp/present-up-to-first-tier.js";

describe("the candidate files a project has", () => {
  const asks = (present: readonly string[]) => {
    const asked: string[] = [];
    const exists = async (path: string) => {
      asked.push(path);
      return present.includes(path);
    };
    return { asked, exists };
  };

  it("stops asking once a tier has a file", async () => {
    const { asked, exists } = asks(["a"]);

    const found = await presentUpToFirstTier([["a", "b"], ["c"]], exists);

    expect([...found]).toEqual(["a"]);
    expect(asked).toEqual(["a", "b"]);
  });

  it("asks the next tier while the earlier one has nothing, answering empty when none does", async () => {
    const { asked, exists } = asks([]);

    const found = await presentUpToFirstTier([["a"], ["b"]], exists);

    expect(found.size).toBe(0);
    expect(asked).toEqual(["a", "b"]);
  });
});
