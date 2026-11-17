/**
 * The size of the lists a set of TypeScript files declares, read from the syntax tree the compiler
 * builds and not from text, so a declaration is seen wherever it sits: after a comment, as the
 * second declarator of a statement, inside a function.
 *
 * A list is sized when it is a `const` whose initializer is an array literal, a record literal, or
 * a `new Set` or `new Map` over an array literal, and none holds a spread. An array counts its leaf
 * entries, so an array of arrays counts the entries of the inner ones. A record counts one per
 * property, a property whose value is an array literal counting the entries of that array; any
 * other value counts one only when it is a string, a number, an object literal, or a name bound to
 * a string literal in the same file.
 *
 * Anything else is `null`: a list that cannot be sized cannot be held. So are a name declared
 * twice in a file or bound by a destructuring, a `let` or `var`, and a list the file mutates by an
 * assignment, an increment, a `delete`, or a call to `push`, `splice`, `unshift`, `add`, `set` or
 * `delete`, through a cast, a non-null assertion or parentheses.
 */
import { tmpdir } from "node:os";
import {
  type ArrayLiteralExpression,
  type BindingName,
  type Expression,
  isArrayLiteralExpression,
  isAsExpression,
  isAssignmentOperator,
  isBinaryExpression,
  isBindingElement,
  isCallExpression,
  isDeleteExpression,
  isElementAccessExpression,
  isIdentifier,
  isNewExpression,
  isNonNullExpression,
  isNoSubstitutionTemplateLiteral,
  isNumericLiteral,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPostfixUnaryExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
  isShorthandPropertyAssignment,
  isSpreadAssignment,
  isSpreadElement,
  isStringLiteral,
  isVariableDeclaration,
  isVariableDeclarationList,
  type Node,
  NodeFlags,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

/** The entries of each list by id, `<file>#<name>`, or `null` where the list cannot be sized. */
export type ListSizes = Map<string, number | null>;

const VIRTUAL_ROOT = `${tmpdir().replaceAll("\\", "/")}/list-sizes`;
const SET_OR_MAP = new Set(["Set", "Map"]);
const MUTATING_METHODS = new Set(["push", "splice", "unshift", "add", "set", "delete"]);
const SINGLE_ENTRY = 1;

/** What a file declares that sizing a list needs to look up. */
interface FileScope {
  /** The names bound to a string literal, which a record value may point at. */
  readonly stringNames: ReadonlySet<string>;
}

function unwrap(expression: Expression): Expression {
  return isAsExpression(expression) ||
    isSatisfiesExpression(expression) ||
    isParenthesizedExpression(expression) ||
    isNonNullExpression(expression)
    ? unwrap(expression.expression)
    : expression;
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  node.forEachChild((child) => {
    walk(child, visit);
  });
}

function isStringLiteralLike(expression: Expression): boolean {
  return isStringLiteral(expression) || isNoSubstitutionTemplateLiteral(expression);
}

function namesBoundToStrings(source: SourceFile): Set<string> {
  const names = new Set<string>();
  walk(source, (node) => {
    if (
      isVariableDeclaration(node) &&
      isIdentifier(node.name) &&
      node.initializer &&
      isStringLiteralLike(unwrap(node.initializer))
    ) {
      names.add(node.name.text);
    }
  });
  return names;
}

function entriesOf(array: ArrayLiteralExpression): number | null {
  return array.elements.some(isSpreadElement) ? null : array.elements.length;
}

function leafEntriesOf(array: ArrayLiteralExpression): number | null {
  let total = 0;
  for (const element of array.elements) {
    if (isSpreadElement(element)) return null;
    const value = unwrap(element);
    const leaves = isArrayLiteralExpression(value) ? leafEntriesOf(value) : SINGLE_ENTRY;
    if (leaves === null) return null;
    total += leaves;
  }
  return total;
}

function isSeenAsOneEntry(value: Expression, scope: FileScope): boolean {
  return (
    isStringLiteralLike(value) ||
    isNumericLiteral(value) ||
    isObjectLiteralExpression(value) ||
    (isIdentifier(value) && scope.stringNames.has(value.text))
  );
}

function recordValue(property: Node): Expression | undefined {
  if (isPropertyAssignment(property)) return unwrap(property.initializer);
  return isShorthandPropertyAssignment(property) && isIdentifier(property.name)
    ? property.name
    : undefined;
}

function recordSize(properties: readonly Node[], scope: FileScope): number | null {
  let total = 0;
  for (const property of properties) {
    if (isSpreadAssignment(property)) return null;
    const value = recordValue(property);
    if (!value) return null;
    const entries = isArrayLiteralExpression(value)
      ? leafEntriesOf(value)
      : isSeenAsOneEntry(value, scope)
        ? SINGLE_ENTRY
        : null;
    if (entries === null) return null;
    total += entries;
  }
  return total;
}

function collectionSize(value: Expression): number | null {
  if (!(isNewExpression(value) && isIdentifier(value.expression))) return null;
  const [argument, ...others] = value.arguments ?? [];
  const array = argument && unwrap(argument);
  return SET_OR_MAP.has(value.expression.text) &&
    array &&
    isArrayLiteralExpression(array) &&
    others.length === 0
    ? entriesOf(array)
    : null;
}

function sizeOf(initializer: Expression | undefined, scope: FileScope): number | null {
  if (!initializer) return null;
  const value = unwrap(initializer);
  if (isArrayLiteralExpression(value)) return leafEntriesOf(value);
  if (isObjectLiteralExpression(value)) return recordSize(value.properties, scope);
  return collectionSize(value);
}

function boundNames(name: BindingName): string[] {
  if (isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    isBindingElement(element) && element.name ? boundNames(element.name) : []
  );
}

function isConstDeclaration(declaration: Node): boolean {
  const list = declaration.parent;
  return !!list && isVariableDeclarationList(list) && (list.flags & NodeFlags.Const) !== 0;
}

/** The name a reference stands on, through a cast, a non-null assertion, parentheses or a member. */
function rootName(expression: Expression): string | null {
  const value = unwrap(expression);
  if (isIdentifier(value)) return value.text;
  return isPropertyAccessExpression(value) || isElementAccessExpression(value)
    ? rootName(value.expression)
    : null;
}

function isIncrementOperator(operator: SyntaxKind): boolean {
  return operator === SyntaxKind.PlusPlusToken || operator === SyntaxKind.MinusMinusToken;
}

/** The operand an increment or a decrement changes, or `undefined` where the node is neither. */
function incrementedOperand(node: Node): Expression | undefined {
  return (isPrefixUnaryExpression(node) || isPostfixUnaryExpression(node)) &&
    isIncrementOperator(node.operator)
    ? node.operand
    : undefined;
}

/** The name a node changes in place or replaces, or `null` where it changes none. */
function mutatedName(node: Node): string | null {
  if (isBinaryExpression(node) && isAssignmentOperator(node.operatorToken.kind)) {
    return rootName(node.left);
  }
  const operand = incrementedOperand(node);
  if (operand) return rootName(operand);
  if (isDeleteExpression(node)) return rootName(node.expression);
  if (isCallExpression(node)) {
    const callee = unwrap(node.expression);
    return isPropertyAccessExpression(callee) && MUTATING_METHODS.has(callee.name.text)
      ? rootName(callee.expression)
      : null;
  }
  return null;
}

/** Every list `isTolerated` accepts in `source`, sized or `null`, by id. */
function readFile(
  file: string,
  source: SourceFile,
  isTolerated: (name: string) => boolean,
  sizes: ListSizes
): void {
  const scope: FileScope = { stringNames: namesBoundToStrings(source) };
  const mutated = new Set<string>();
  walk(source, (node) => {
    if (isVariableDeclaration(node)) {
      for (const name of boundNames(node.name).filter(isTolerated)) {
        const id = `${file}#${name}`;
        const alone = isIdentifier(node.name) && !sizes.has(id) && isConstDeclaration(node);
        sizes.set(id, alone ? sizeOf(node.initializer, scope) : null);
      }
    }
    const name = mutatedName(node);
    if (name !== null && isTolerated(name)) mutated.add(name);
  });
  for (const name of mutated) {
    const id = `${file}#${name}`;
    if (sizes.has(id)) sizes.set(id, null);
  }
}

/**
 * The lists the files declare, by id. `files` maps a path, relative to a common root, to its
 * text. A compiler process is started for the call, so a caller reads every file in one call.
 */
export function listSizes(
  files: Readonly<Record<string, string>>,
  isTolerated: (name: string) => boolean
): ListSizes {
  const sizes: ListSizes = new Map();
  const paths = Object.keys(files);
  if (paths.length === 0) return sizes;
  const at = (path: string) => `${VIRTUAL_ROOT}/${path}`;
  const config = JSON.stringify({
    compilerOptions: { noLib: true, noResolve: true, types: [] },
    files: paths.map(at),
  });
  const api = new API({
    cwd: VIRTUAL_ROOT,
    fs: createVirtualFileSystem({
      [at("tsconfig.json")]: config,
      ...Object.fromEntries(paths.map((path) => [at(path), files[path] as string])),
    }),
  });
  try {
    const [project] = api.updateSnapshot({ openProject: at("tsconfig.json") }).getProjects();
    for (const path of paths) {
      const source = project?.program.getSourceFile(at(path));
      if (!source) throw new Error(`the compiler returned no source for ${path}`);
      readFile(path, source, isTolerated, sizes);
    }
  } finally {
    api.close();
  }
  return sizes;
}
