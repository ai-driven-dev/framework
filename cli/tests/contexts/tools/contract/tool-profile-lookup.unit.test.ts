import { describe, expect, it } from "vitest";
import {
  aiProfileOf,
  aiProfileOrNone,
  ideProfileOf,
  profileOf,
} from "../../../../src/contexts/tools/contract/tool-profile-lookup.js";
import { UnregisteredToolError } from "../../../../src/kernel/errors.js";
import type { AiToolId, IdeToolId } from "../../../../src/kernel/tool.js";
import { catalogOf } from "../testing/catalog-of.js";

describe("tool profile lookup", () => {
  it("finds the profile of a tool the caller was handed", () => {
    expect(profileOf(catalogOf().sortedById(), "claude").toolId).toBe("claude");
  });

  it("refuses a tool absent from the profiles it was handed", () => {
    const withoutClaude = catalogOf()
      .sortedById()
      .filter((profile) => profile.toolId !== "claude");

    expect(() => profileOf(withoutClaude, "claude")).toThrow(UnregisteredToolError);
  });

  it("refuses an IDE profile where an AI one is asked for, and the reverse", () => {
    const tools = catalogOf().sortedById();
    const ide: string = "vscode";
    const ai: string = "claude";

    expect(() => aiProfileOf(tools, ide as AiToolId)).toThrow(UnregisteredToolError);
    expect(() => ideProfileOf(tools, ai as IdeToolId)).toThrow(UnregisteredToolError);
  });

  describe("an AI profile or none", () => {
    it("finds the AI profile of a tool the caller was handed", () => {
      expect(aiProfileOrNone(catalogOf().sortedById(), "claude")?.toolId).toBe("claude");
    });

    it("answers none for an editor", () => {
      expect(aiProfileOrNone(catalogOf().sortedById(), "vscode")).toBeUndefined();
    });

    it("refuses a tool absent from the profiles it was handed", () => {
      const withoutClaude = catalogOf()
        .sortedById()
        .filter((profile) => profile.toolId !== "claude");

      expect(() => aiProfileOrNone(withoutClaude, "claude")).toThrow(UnregisteredToolError);
    });
  });
});
