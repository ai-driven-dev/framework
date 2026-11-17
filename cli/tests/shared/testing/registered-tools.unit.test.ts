import { describe, expect, it } from "vitest";
import { registeredTools, TOOL } from "./registered-tools.js";

describe("the registered tools kit", () => {
  it("mints one id per registered tool, in the catalog's canonical order", () => {
    expect(Object.values(TOOL)).toEqual([...registeredTools().idsInCanonicalOrder()]);
  });

  it("answers a profile for a minted id", () => {
    expect(registeredTools().aiProfile(TOOL.claude).toolId).toBe(TOOL.claude);
  });
});
