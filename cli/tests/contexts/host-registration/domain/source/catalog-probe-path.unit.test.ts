import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { marketplaceCatalogProbePath } from "../../../../../src/contexts/host-registration/domain/source/catalog-probe-path.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const DIR = "/marketplace";

describe("marketplaceCatalogProbePath", () => {
  it("names the catalog file the tool's own profile declares", () => {
    expect(marketplaceCatalogProbePath(registeredTools().profile(TOOL.opencode), DIR)).toBe(
      join(DIR, "opencode.json")
    );
  });

  it.each([
    ["is not an AI tool", TOOL.vscode],
    ["declares no marketplace catalog", TOOL.antigravity],
  ])("names nothing for a tool that %s", (_why, tool) => {
    expect(marketplaceCatalogProbePath(registeredTools().profile(tool), DIR)).toBeUndefined();
  });
});
