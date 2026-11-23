import { describe, expect, it } from "vitest";
import { claude } from "../../../src/composition/tool-profiles/claude.js";
import {
  expectClaudeStyleCatalog,
  pluginTreeShapeOf,
  SHIPPED_AS_IS,
} from "../../contexts/tools/testing/profile-tables.builder.js";

describe("claude build and conversion tables", () => {
  it("ships the plugin tree as it is", () => {
    expect(pluginTreeShapeOf(claude)).toStrictEqual(SHIPPED_AS_IS);
  });

  it("writes its catalog and entries in Claude's marketplace format", async () => {
    await expectClaudeStyleCatalog(claude, ".claude-plugin");
  });
});
