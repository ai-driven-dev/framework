/**
 * A recorded digest is judged by `driftOf` and nowhere else: one verdict ("ok", "missing",
 * "modified") for every site that compares a hash read from disk with a recorded one. Reading the
 * syntax tree, no file but `drift.ts` may compare with `===` or `!==` an operand whose text names
 * a hash or a digest, a variable (`digest`), a property (`file.hash.value`) or a call
 * (`readFileHash(path).value`). A comparison between two `FileHash` values goes through
 * `FileHash.equals`, a method call, not read here.
 *
 * Written limit: a comparison of two operands neither of which is named for a hash or a digest is
 * not seen. `driftOf` lives in `installation`, which `tools` does not import, so a tools file
 * compares through `FileHash.equals`.
 */
import {
  isAwaitExpression,
  isBinaryExpression,
  isCallExpression,
  isIdentifier,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  type Node,
  SyntaxKind,
} from "typescript/unstable/ast";
import { describe, expect, it } from "vitest";
import { readEach } from "./kind-rule-support.js";
import { read, sourceFiles } from "./source-graph.js";
import { walk } from "./ts-project.js";

const THE_ONE_COMPARISON = "src/contexts/installation/domain/drift.ts";
const NAMED_FOR_A_HASH = /(hash|digest)$/i;

/** The name an operand ends in: `digest`, `file.hash.value` => `hash`, `(await readFileHash(p)).value` => `readFileHash`. */
function endsIn(node: Node): string {
  if (isIdentifier(node)) return node.text;
  if (isPropertyAccessExpression(node)) {
    return node.name.text === "value" ? endsIn(node.expression) : node.name.text;
  }
  if (isCallExpression(node)) return endsIn(node.expression);
  if (isParenthesizedExpression(node) || isAwaitExpression(node)) return endsIn(node.expression);
  return "";
}

function isNamedForAHash(node: Node): boolean {
  return NAMED_FOR_A_HASH.test(endsIn(node));
}

const COMPARING = new Set([
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
]);

function comparesAHash(node: Node): boolean {
  return (
    isBinaryExpression(node) &&
    COMPARING.has(node.operatorToken.kind) &&
    (isNamedForAHash(node.left) || isNamedForAHash(node.right))
  );
}

function hashComparisons(files: Readonly<Record<string, string>>): string[] {
  return readEach(files, (path, root) => {
    const found: string[] = [];
    walk(root, (node) => {
      if (comparesAHash(node))
        found.push(`${path} :: ${root.text.slice(node.pos, node.end).trim()}`);
    });
    return found;
  });
}

describe("hash comparison", () => {
  it("sees a hash or a digest compared with either operator and on either side", () => {
    const found = hashComparisons({
      "a.ts":
        "if (file.hash.value !== b) f();\nif (a === (await fs.readFileHash(p)).value) g();\nif (a !== digest) h();\nif (digest === a) i();",
      "b.ts": "if (a.name.value === b) f();\nconst same = x.equals(y);",
    });

    expect(found).toHaveLength(4);
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
