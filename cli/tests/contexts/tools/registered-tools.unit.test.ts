import { describe, expect, it } from "vitest";
import {
  registeredTools,
  resolveRegisteredToolId,
  TOOL,
} from "../../shared/testing/registered-tools.builder.js";

describe("the registered tools kit", () => {
  it("mints one id per registered tool, in the catalog's canonical order", () => {
    const canonical = [...registeredTools().idsInCanonicalOrder()];

    expect(Object.keys(TOOL)).toEqual(canonical);
    expect(Object.values(TOOL)).toEqual(canonical);
  });

  it("answers a profile for a minted id", () => {
    expect(registeredTools().aiProfile(TOOL.claude).toolId).toBe(TOOL.claude);
  });

  it("resolves a written id to the registered one, and an unregistered name to null", () => {
    expect(resolveRegisteredToolId("claude")).toBe(TOOL.claude);
    expect(resolveRegisteredToolId("no-such-tool")).toBeNull();
  });
});
