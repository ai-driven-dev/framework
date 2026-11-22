import { describe, expect, it } from "vitest";
import {
  registeredAiProfile,
  registeredProfile,
} from "../../../../shared/testing/catalog-of.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

describe("asking a profile for its machine-local files", () => {
  it("answers none for an editor", () => {
    expect(registeredProfile(TOOL.vscode).machineLocalFiles()).toEqual([]);
  });

  it("answers the file its marketplace registration keeps", () => {
    const claude = registeredAiProfile(TOOL.claude);
    expect(claude.machineLocalFiles()).toEqual(
      claude.marketplaceRegistration()?.machineLocalFiles()
    );
    expect(claude.machineLocalFiles().length).toBeGreaterThan(0);
  });

  it("answers none for a tool with no marketplace registration", () => {
    expect(registeredAiProfile(TOOL.cursor).machineLocalFiles()).toEqual([]);
  });
});
