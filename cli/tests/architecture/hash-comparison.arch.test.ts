/**
 * A recorded digest is judged by `driftOf` and nowhere else: one verdict ("ok", "missing",
 * "modified") for every site that compares a hash read from disk with a recorded one. Reading the
 * syntax tree, no file but `drift.ts` may compare with `===` or `!==` the `.value` of something
 * named for a hash (`file.hash.value`, `onDiskHash.value`, `readFileHash(path).value`).
 *
 * Written limit: a hash held in a variable is seen only when its name says so, and a comparison
 * through `FileHash.equals` is a method call, not read here.
 */
import {
  isBinaryExpression,
  isPropertyAccessExpression,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { describe, expect, it } from "vitest";
import { readEach } from "./kind-rule-support.js";
import { read, sourceFiles } from "./source-graph.js";
import { walk } from "./ts-project.js";

const THE_ONE_COMPARISON = "src/contexts/installation/domain/drift.ts";
const NAMED_FOR_A_HASH = /hash/i;

function isHashValue(node: Node, root: SourceFile): boolean {
  return (
    isPropertyAccessExpression(node) &&
    node.name.text === "value" &&
    NAMED_FOR_A_HASH.test(root.text.slice(node.expression.pos, node.expression.end))
  );
}

const COMPARING = new Set([
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
]);

function comparesAHash(node: Node, root: SourceFile): boolean {
  return (
    isBinaryExpression(node) &&
    COMPARING.has(node.operatorToken.kind) &&
    (isHashValue(node.left, root) || isHashValue(node.right, root))
  );
}

function hashComparisons(files: Readonly<Record<string, string>>): string[] {
  return readEach(files, (path, root) => {
    const found: string[] = [];
    walk(root, (node) => {
      if (comparesAHash(node, root))
        found.push(`${path} :: ${root.text.slice(node.pos, node.end).trim()}`);
    });
    return found;
  });
}

describe("hash comparison", () => {
  it("sees a hash value compared with either operator and on either side", () => {
    const found = hashComparisons({
      "a.ts":
        "if (file.hash.value !== digest) f();\nif (digest === (await fs.readFileHash(p)).value) g();",
      "b.ts": "if (a.name.value === b) f();\nconst same = x.equals(y);",
    });

    expect(found).toHaveLength(2);
  });

  it("keeps every comparison of a recorded digest inside driftOf", () => {
    const files = Object.fromEntries(
      sourceFiles()
        .filter((file) => file !== THE_ONE_COMPARISON)
        .map((file) => [file, read(file)])
    );

    expect(hashComparisons(files)).toEqual([]);
  });
});
