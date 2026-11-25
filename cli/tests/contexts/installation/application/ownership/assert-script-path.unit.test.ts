import { describe, expect, it } from "vitest";
import { assertScriptPath } from "../../../../../src/contexts/installation/application/ownership/assert-script-path.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

function check(relativePath: string): void {
  const delivery = registeredTools().aiProfile(TOOL.cursor).projectHooksDelivery();
  if (delivery === null) throw new Error("cursor delivers project hooks");
  assertScriptPath({
    format: delivery.format,
    toolName: "Cursor",
    pluginName: "aidd-context",
    relativePath,
  });
}

describe("checking a script path", () => {
  it("accepts a path inside the plugin script directory", () => {
    expect(() => check(".cursor/hooks/aidd-context/pre.js")).not.toThrow();
  });

  it.each([
    ".cursor/hooks/other/pre.js",
    "/abs/.cursor/hooks/aidd-context/pre.js",
    ".cursor/hooks/aidd-context\\pre.js",
    ".cursor/hooks/aidd-context/../other/pre.js",
  ])("refuses %s", (path) => {
    expect(() => check(path)).toThrow(/unproven provenance/);
  });
});
