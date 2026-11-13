import { describe, expect, it } from "vitest";
import { registeredAiProfile, registeredProfile } from "../../testing/catalog-of.js";

describe("ToolProfile.machineLocalFiles()", () => {
  it("answers none for an editor", () => {
    expect(registeredProfile("vscode").machineLocalFiles()).toEqual([]);
  });

  it("answers the file its marketplace registration keeps", () => {
    const claude = registeredAiProfile("claude");
    expect(claude.machineLocalFiles()).toEqual(
      claude.marketplaceRegistration()?.machineLocalFiles()
    );
    expect(claude.machineLocalFiles().length).toBeGreaterThan(0);
  });

  it("answers none for a tool with no marketplace registration", () => {
    expect(registeredAiProfile("cursor").machineLocalFiles()).toEqual([]);
  });
});
