/**
 * The names a file uses in a way other than reading them, found in the syntax tree. A name may
 * appear only as:
 * - the receiver of a read member (`READ_MEMBERS`) that is not itself assigned, deleted or counted;
 * - an element read through a field (`LIST[key]?.count`);
 * - the argument of `Object.keys` or `Object.entries`;
 * - the iterable of a `for...of`, or a spread inside an array literal;
 * - an argument to one of `READING_CALLEES`.
 *
 * Any other appearance counts as a use beyond reading, so a way of changing a list nobody thought
 * of is refused by default. A cast, a non-null assertion and parentheses are looked through.
 * Declarations, import specifiers and property names are not uses.
 */
import {
  type Identifier,
  isArrayLiteralExpression,
  isAsExpression,
  isAssignmentOperator,
  isBinaryExpression,
  isCallExpression,
  isDeleteExpression,
  isElementAccessExpression,
  isForOfStatement,
  isIdentifier,
  isNonNullExpression,
  isParenthesizedExpression,
  isPostfixUnaryExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isSatisfiesExpression,
  isShorthandPropertyAssignment,
  isSpreadElement,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";

const READ_MEMBERS = new Set(["map", "flatMap"]);
const OBJECT_READERS = new Set(["keys", "entries"]);
const OBJECT = "Object";
/**
 * The only functions a tolerated list may be handed to, each read-only by its body:
 * `expectRatchet` (tests/architecture/helpers.ts) copies both lists into
 * Sets and filters them; `transitionalDrift` (context-graph.arch.test.ts) tests membership with
 * `in` and walks the record with `Object.entries`. A name is trusted, its body is not re-checked:
 * a same-named function written elsewhere to change the list is a limit.
 */
const READING_CALLEES = new Set(["expectRatchet", "transitionalDrift"]);

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  node.forEachChild((child) => {
    walk(child, visit);
  });
}

function wraps(parent: Node, node: Node): boolean {
  return (
    (isAsExpression(parent) ||
      isSatisfiesExpression(parent) ||
      isParenthesizedExpression(parent) ||
      isNonNullExpression(parent)) &&
    parent.expression === node
  );
}

/** The node itself, or the outermost cast, assertion or parentheses around it. */
function outermost(node: Node): Node {
  return wraps(node.parent, node) ? outermost(node.parent) : node;
}

function isAssignedDeletedOrCounted(use: Node): boolean {
  const parent = use.parent;
  if (isBinaryExpression(parent)) {
    return isAssignmentOperator(parent.operatorToken.kind) && parent.left === use;
  }
  if (isPrefixUnaryExpression(parent) || isPostfixUnaryExpression(parent)) {
    return (
      parent.operator === SyntaxKind.PlusPlusToken || parent.operator === SyntaxKind.MinusMinusToken
    );
  }
  return isDeleteExpression(parent);
}

function isCalled(use: Node): boolean {
  return isCallExpression(use.parent) && use.parent.expression === use;
}

/** A field read from what `node` holds: `node.count`, not called and not written. */
function isFieldRead(node: Node): boolean {
  const parent = node.parent;
  if (!(isPropertyAccessExpression(parent) && parent.expression === node)) return false;
  const field = outermost(parent);
  return !isCalled(field) && !isAssignedDeletedOrCounted(field);
}

function isReadMember(use: Node): boolean {
  const parent = use.parent;
  return (
    isPropertyAccessExpression(parent) &&
    parent.expression === use &&
    READ_MEMBERS.has(parent.name.text) &&
    !isAssignedDeletedOrCounted(outermost(parent))
  );
}

function isElementReadThroughField(use: Node): boolean {
  const parent = use.parent;
  if (!(isElementAccessExpression(parent) && parent.expression === use)) return false;
  const element = outermost(parent);
  return !isAssignedDeletedOrCounted(element) && isFieldRead(element);
}

function isObjectReader(callee: Node): boolean {
  return (
    isPropertyAccessExpression(callee) &&
    isIdentifier(callee.expression) &&
    callee.expression.text === OBJECT &&
    OBJECT_READERS.has(callee.name.text)
  );
}

function isArgumentOfReader(use: Node): boolean {
  const call = use.parent;
  if (!(isCallExpression(call) && call.arguments.some((argument) => argument === use)))
    return false;
  const callee = call.expression;
  return isIdentifier(callee) ? READING_CALLEES.has(callee.text) : isObjectReader(callee);
}

function isIteratedOrSpread(use: Node): boolean {
  const parent = use.parent;
  return (
    (isForOfStatement(parent) && parent.expression === use) ||
    (isSpreadElement(parent) && isArrayLiteralExpression(parent.parent))
  );
}

function isReadUse(reference: Node): boolean {
  const use = outermost(reference);
  return (
    isReadMember(use) ||
    isElementReadThroughField(use) ||
    isArgumentOfReader(use) ||
    isIteratedOrSpread(use)
  );
}

/** A name that stands for the value, not one that declares or labels it. */
function isReference(identifier: Identifier): boolean {
  const parent = identifier.parent;
  if (isShorthandPropertyAssignment(parent)) return true;
  const labels = "name" in parent && parent.name === identifier;
  const picks = "propertyName" in parent && parent.propertyName === identifier;
  return !labels && !picks;
}

/** The names `isTolerated` accepts that `source` uses in a way other than reading them. */
export function namesUsedBeyondReading(
  source: SourceFile,
  isTolerated: (name: string) => boolean
): Set<string> {
  const names = new Set<string>();
  walk(source, (node) => {
    if (isIdentifier(node) && isTolerated(node.text) && isReference(node) && !isReadUse(node)) {
      names.add(node.text);
    }
  });
  return names;
}
