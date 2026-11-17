import { describe, expect, it } from "vitest";
import { wireTools } from "../../../src/composition/tools.js";
import { registeredTools, TOOL } from "./registered-tools.js";

describe("the registered tools kit", () => {
  it("mints one id per registered tool, in the catalog's canonical order", () => {
    expect(Object.values(TOOL).sort()).toEqual([...registeredTools().idsInCanonicalOrder()].sort());
  });

  it("answers the same tools as the composition wiring", () => {
    expect(registeredTools().idsInCanonicalOrder()).toEqual(wireTools().idsInCanonicalOrder());
  });

  it("answers a profile for a minted id", () => {
    expect(registeredTools().aiProfile(TOOL.claude).toolId).toBe(TOOL.claude);
  });
});
