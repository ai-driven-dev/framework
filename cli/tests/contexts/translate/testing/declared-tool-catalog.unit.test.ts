import { describe, expect, it } from "vitest";
import { UnregisteredToolError } from "../../../../src/shared/domain/shared.error.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { catalogDeclaring } from "./declared-tool-catalog.builder.js";

describe("a catalog declaring synthetic tools", () => {
  it("refuses a tool it was not told about, as a real catalog does", () => {
    const catalog = catalogDeclaring([{ id: TOOL.claude }]);

    expect(() => catalog.aiProfile(TOOL.cursor)).toThrow(UnregisteredToolError);
  });

  it("answers the declared ids in the registered order, whatever order they were given in", () => {
    const catalog = catalogDeclaring([{ id: TOOL.cursor }, { id: TOOL.claude }]);

    expect(catalog.inHelpOrder("ai")).toEqual<AiToolId[]>([TOOL.claude, TOOL.cursor]);
    expect(catalog.idsInCanonicalOrder("ai")).toEqual<AiToolId[]>([TOOL.claude, TOOL.cursor]);
  });
});
