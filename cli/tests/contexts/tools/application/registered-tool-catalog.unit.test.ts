import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import { DuplicateToolIdError, UnregisteredToolError } from "../../../../src/kernel/errors.js";
import type { AiToolId } from "../../../../src/kernel/tool.js";
import { catalogOf } from "../testing/catalog-of.js";

describe("the registered tool catalog", () => {
  it("lists the tools of a category in registration order, the order a help text names them", () => {
    const catalog = catalogOf();

    expect(catalog.inHelpOrder("ai")).toEqual([
      "claude",
      "cursor",
      "copilot",
      "codex",
      "opencode",
      "kilo",
      "antigravity",
    ]);
    expect(catalog.inHelpOrder("ide")).toEqual(["vscode"]);
  });

  it("follows the order its profiles were registered in, not the id order", () => {
    const catalog = catalogOf([...REGISTERED_PROFILES].reverse());

    expect(catalog.inHelpOrder("ai")[0]).toBe("antigravity");
    expect(catalog.inHelpOrder("ai").at(-1)).toBe("claude");
  });

  it("lists every profile sorted by id, the order the setup and doctor flows walk them", () => {
    const sorted = catalogOf().sortedById();

    expect(sorted.map((profile) => profile.toolId)).toEqual([
      "antigravity",
      "claude",
      "codex",
      "copilot",
      "cursor",
      "kilo",
      "opencode",
      "vscode",
    ]);
  });

  it("sorts by id whatever order its profiles were registered in", () => {
    const sorted = catalogOf([...REGISTERED_PROFILES].reverse()).sortedById();

    expect(sorted[0]?.toolId).toBe("antigravity");
  });

  it("answers the profile of a registered id, and refuses an unregistered one", () => {
    expect(catalogOf().profile("claude").toolId).toBe("claude");
    expect(() => catalogOf([]).profile("claude")).toThrow(UnregisteredToolError);
  });

  it("refuses two profiles declaring the same id", () => {
    const twice = [...REGISTERED_PROFILES.slice(0, 1), ...REGISTERED_PROFILES.slice(0, 1)];
    expect(() => catalogOf(twice)).toThrow(DuplicateToolIdError);
  });

  describe("asked by kind", () => {
    const ide: string = "vscode";

    it("answers the AI profile of an AI id, and refuses an editor or an unregistered id", () => {
      expect(catalogOf().aiProfile("claude").toolId).toBe("claude");
      expect(() => catalogOf().aiProfile(ide as AiToolId)).toThrow(UnregisteredToolError);
      expect(() => catalogOf([]).aiProfile("claude")).toThrow(UnregisteredToolError);
    });
  });
});
