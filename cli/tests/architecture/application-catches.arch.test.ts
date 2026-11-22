/**
 * A use case never catches its own errors: only a scenario collects a partial failure, and it
 * keeps the typed error. The context `application/` files that still catch are the entries of
 * the `application-catches` debt in `kinds-debt.json`, with how many each holds. The count
 * matches exactly: lowering is forced, a raise is caught in review. A `catch` in a comment or a
 * string is no catch: the syntax tree is read.
 */
import {
  isCallExpression,
  isCatchClause,
  isPropertyAccessExpression,
  type SourceFile,
} from "typescript/unstable/ast";
import { describe, expect, it } from "vitest";
import { debtEntries, readEach } from "./kind-rule-support.js";
import { read, sourceFiles } from "./source-graph.js";
import { walk } from "./ts-project.js";

const RULE = "application-catches";

function catchCount(root: SourceFile): number {
  let count = 0;
  walk(root, (node) => {
    const isPromiseCatch =
      isCallExpression(node) &&
      isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "catch";
    if (isCatchClause(node) || isPromiseCatch) count++;
  });
  return count;
}

function catchesByFile(files: Readonly<Record<string, string>>): Record<string, number> {
  const found = readEach(files, (path, root) => [[path, catchCount(root)] as const]);
  return Object.fromEntries(found.filter(([, count]) => count > 0));
}

describe("application catches", () => {
  it("counts a catch clause and a catch call, and not the word in a comment or a string", () => {
    const counted = catchesByFile({
      "a.ts": "try { a(); } catch (e) { b(); }\nawait c().catch(() => 0);",
      "b.ts": "// catch (e)\nconst w = 'catch (e) {';\n/* .catch(x) */",
    });

    expect(counted).toEqual({ "a.ts": 2 });
  });

  it("holds every context application file to the catches written down in kinds-debt.json", () => {
    const files = Object.fromEntries(
      sourceFiles()
        .filter((file) => /^src\/contexts\/[^/]+\/application\//.test(file))
        .map((file) => [file, read(file)])
    );

    expect(catchesByFile(files)).toEqual(debtEntries(RULE));
  });
});
