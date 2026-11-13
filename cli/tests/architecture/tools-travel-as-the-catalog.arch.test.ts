/**
 * A use case that receives its tools as a profile array re-implements the lookup each time it needs
 * one tool, and a test narrowing that array to the acting tool breaks what asks about another. The
 * catalog answers by id, so only the tools context and the presentation edge may type a profile list.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./helpers.js";

const PROFILE_LIST = /ToolProfile\[\]|Array<(?:Ai|Ide)?ToolProfile>/;
const MAY_TYPE_A_LIST = /^src\/(?:contexts\/tools\/|presentation\/)/;

function typesAProfileList(source: string): boolean {
  return PROFILE_LIST.test(source);
}

describe("tools travel as the catalog", () => {
  it("types no profile list outside the tools context and presentation", () => {
    const offenders = sourceFiles()
      .filter((file) => !MAY_TYPE_A_LIST.test(file))
      .filter((file) => typesAProfileList(read(file)));

    expect(offenders, "take the ToolCatalog and ask it for the tool by id").toEqual([]);
  });
});

describe("the guard itself", () => {
  it("sees a profile list however it is written", () => {
    expect(typesAProfileList("tools: readonly ToolProfile[];")).toBe(true);
    expect(typesAProfileList("tools: AiToolProfile[];")).toBe(true);
    expect(typesAProfileList("tools: Array<ToolProfile>;")).toBe(true);
  });

  it("lets a catalog through", () => {
    expect(typesAProfileList("tools: ToolCatalog;")).toBe(false);
  });
});
