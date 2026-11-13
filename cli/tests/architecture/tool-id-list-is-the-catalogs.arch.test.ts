/**
 * The list of AI tool ids is the shared domain's, and the catalog is what answers it to everyone else. A
 * caller that walks `AI_TOOL_IDS` itself holds a second list of the tools, which a sixth tool has
 * to be added to once more. Parsing a flag value stays on the id type's own guard, `isAiToolId`,
 * which is not the list.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./helpers.js";

const MAY_NAME_THE_LIST = /^src\/(?:shared\/domain\/|contexts\/tools\/)/;
const THE_LIST = /\bAI_TOOL_IDS\b/;

function namesTheList(source: string): boolean {
  return THE_LIST.test(source);
}

describe("the tool id list is the catalog's", () => {
  it("is named only in shared/domain and the tools context", () => {
    const offenders = sourceFiles()
      .filter((file) => !MAY_NAME_THE_LIST.test(file))
      .filter((file) => namesTheList(read(file)));

    expect(offenders, "ask ToolCatalog.aiIdsInCanonicalOrder() instead").toEqual([]);
  });
});

describe("the guard itself", () => {
  it("sees the list however it is imported or used", () => {
    expect(namesTheList('import { AI_TOOL_IDS } from "../../shared/domain/tool.js";')).toBe(true);
    expect(namesTheList("for (const id of AI_TOOL_IDS) {}")).toBe(true);
  });

  it("lets the id type's own guard through", () => {
    expect(namesTheList('import { isAiToolId } from "../../shared/domain/tool.js";')).toBe(false);
  });
});
