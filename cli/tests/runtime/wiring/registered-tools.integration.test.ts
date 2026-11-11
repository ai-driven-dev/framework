import { describe, expect, it } from "vitest";
import { getAllRegisteredTools } from "../../../src/contexts/tools/domain/registry.js";
import "../../../src/runtime/wiring/framework.js";

describe("the tools the real composition registers", () => {
  it("come out sorted by id, the order the setup and doctor flows walk them", () => {
    const ids = [...getAllRegisteredTools().keys()];

    expect(ids.length).toBeGreaterThan(1);
    expect(ids).toEqual([...ids].sort());
  });
});
