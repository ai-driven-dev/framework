/**
 * A tool profile is data: every behaviour it wires is a named conversion imported from the tools
 * context, referenced bare. A function written in `composition/tool-profiles/` is logic the
 * conformance contract cannot see, so the guard reports each one by file and line.
 */
import {
  isArrowFunction,
  isFunctionDeclaration,
  isFunctionExpression,
  isMethodDeclaration,
  type Node,
} from "typescript/unstable/ast";
import { describe, expect, it } from "vitest";
import { src } from "./kind-rule-fixtures.js";
import { readEach } from "./kind-rule-support.js";
import { walk } from "./ts-project.js";

const PROFILES = "src/composition/tool-profiles/";

/** Whitespace and comments before a node: its position counts them, its line does not. */
const LEADING_TRIVIA = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/;

const declaresFunction = (node: Node): boolean =>
  isFunctionDeclaration(node) ||
  isFunctionExpression(node) ||
  isArrowFunction(node) ||
  isMethodDeclaration(node);

/** Each function a profile file declares, as `path:line`. */
function functionsIn(files: Readonly<Record<string, string>>): string[] {
  return readEach(files, (path, root) => {
    const found: string[] = [];
    walk(root, (node) => {
      if (!declaresFunction(node)) return;
      const text = root.text.slice(node.pos, node.end).replace(LEADING_TRIVIA, "");
      const line = root.text.slice(0, node.end - text.length).split("\n").length;
      found.push(`${path}:${line} :: ${text.slice(0, 60).replace(/\s+/g, " ")}`);
    });
    return found;
  });
}

const profileFiles = (): Record<string, string> =>
  Object.fromEntries(Object.entries(src()).filter(([path]) => path.startsWith(PROFILES)));

describe("a tool profile declares no function", () => {
  it("holds every real profile", { timeout: 30_000 }, () => {
    const files = profileFiles();
    expect(Object.keys(files).length, "the guard read no profile").toBeGreaterThan(0);
    expect(functionsIn(files)).toEqual([]);
  });

  it.each([
    ["a function declaration", "function f() { return 1; }\nexport const p = { f };"],
    ["a function expression", "export const p = { f: function () { return 1; } };"],
    ["an arrow", "export const p = { f: (x: string) => x };"],
    ["a method shorthand", "export const p = { f() { return 1; } };"],
  ])("reports %s", (_case, text) => {
    expect(functionsIn({ [`${PROFILES}planted.ts`]: text })).toHaveLength(1);
  });

  it("accepts a bare reference to an imported named conversion", () => {
    const text = 'import { toMdc } from "./formats.js";\nexport const p = { convert: toMdc };';
    expect(functionsIn({ [`${PROFILES}planted.ts`]: text })).toEqual([]);
  });
});
