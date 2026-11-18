import { describe, expect, it } from "vitest";
import { registeredTools, resolveRegisteredToolId, TOOL } from "./registered-tools.js";

describe("the registered tools kit", () => {
  it("mints one id per registered tool, in the catalog's canonical order", () => {
    expect(Object.values(TOOL)).toEqual([...registeredTools().idsInCanonicalOrder()]);
  });

  it("answers a profile for a minted id", () => {
    expect(registeredTools().aiProfile(TOOL.claude).toolId).toBe(TOOL.claude);
  });

  it("resolves a written id to the registered one, and an unregistered name to null", () => {
    expect(resolveRegisteredToolId("claude")).toBe(TOOL.claude);
    expect(resolveRegisteredToolId("no-such-tool")).toBeNull();
  });
});
