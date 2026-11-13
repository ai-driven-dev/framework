import { describe, expect, it } from "vitest";
import { assertKnownToolId } from "../../../src/presentation/commands/framework.js";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";

describe("assertKnownToolId", () => {
  it("accepts an AI tool id", () => {
    expect(() => assertKnownToolId("claude", catalogOf())).not.toThrow();
  });

  it("accepts an IDE tool id", () => {
    expect(() => assertKnownToolId("vscode", catalogOf())).not.toThrow();
  });

  it("refuses an unknown id and lists every one it would have taken", () => {
    expect(() => assertKnownToolId("emacs", catalogOf())).toThrow(
      "Unknown tool: emacs. Valid tools: claude, cursor, copilot, opencode, kilo, codex, antigravity, vscode"
    );
  });

  it("refuses an empty id rather than treating it as no filter", () => {
    expect(() => assertKnownToolId("", catalogOf())).toThrow("Unknown tool: .");
  });
});
