/**
 * The guard sizes the declared literal of each tolerated list and holds that size; it refuses what
 * it cannot size, and mutation after the declaration, by any path, is out of scope and left to
 * review.
 *
 * A list is sized when it is a `const` whose initializer is an array literal, a record literal, or
 * a `new Set` or `new Map` over an array literal, and none holds a spread. An array counts its leaf
 * entries, so an array of arrays counts the entries of the inner ones. A record counts one per
 * property, a property whose value is an array literal counting the entries of that array; any
 * other value counts one only when it is a string, a number, an object literal, or a name bound to
 * a string literal in the same file.
 *
 * Refused, as `null`: a list that cannot be sized cannot be held, so a non-literal initializer, a
 * `let` or `var`, a type that is not readonly (`readonly T[]`, `ReadonlyArray`, `Readonly`,
 * `ReadonlySet`, `ReadonlyMap`, or `as const`; the compiler then blocks a `push` through an alias), a spread, a record value the reading cannot see into, and a name declared twice
 * in a file. A name bound by a destructuring is not read at all.
 */
import { tmpdir } from "node:os";
import {
  type ArrayLiteralExpression,
  type Expression,
  isArrayLiteralExpression,
  isAsExpression,
  isIdentifier,
  isNewExpression,
  isNoSubstitutionTemplateLiteral,
  isNumericLiteral,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
  isShorthandPropertyAssignment,
  isSpreadElement,
  isStringLiteral,
  isTypeOperatorNode,
  isTypeReferenceNode,
  isVariableDeclaration,
  isVariableDeclarationList,
  type Node,
  NodeFlags,
  type SourceFile,
  SyntaxKind,
  type VariableDeclaration,
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

/** The entries of each list by id, `<file>#<name>`, or `null` where the list cannot be sized. */
export type ListSizes = Map<string, number | null>;

const VIRTUAL_ROOT = `${tmpdir().replaceAll("\\", "/")}/list-sizes`;
const SET_OR_MAP = new Set(["Set", "Map"]);
const SINGLE_ENTRY = 1;
const READONLY_TYPES = new Set(["Readonly", "ReadonlyArray", "ReadonlySet", "ReadonlyMap"]);
const CONST_ASSERTION = "const";

/** What a file declares that sizing a list needs to look up. */
interface FileScope {
  /** The names bound to a string literal, which a record value may point at. */
  readonly stringNames: ReadonlySet<string>;
}

function unwrap(expression: Expression): Expression {
  return isAsExpression(expression) ||
    isSatisfiesExpression(expression) ||
    isParenthesizedExpression(expression)
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
  const [argument] = value.arguments ?? [];
  const array = argument && unwrap(argument);
  return SET_OR_MAP.has(value.expression.text) && array && isArrayLiteralExpression(array)
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

function isReadonlyType(type: Node | undefined): boolean {
  if (!type) return false;
  if (isTypeOperatorNode(type)) return type.operator === SyntaxKind.ReadonlyKeyword;
  return (
    isTypeReferenceNode(type) &&
    isIdentifier(type.typeName) &&
    READONLY_TYPES.has(type.typeName.text)
  );
}

function isConstAssertion(initializer: Expression | undefined): boolean {
  return (
    !!initializer &&
    isAsExpression(initializer) &&
    isTypeReferenceNode(initializer.type) &&
    isIdentifier(initializer.type.typeName) &&
    initializer.type.typeName.text === CONST_ASSERTION
  );
}

/** A list the compiler will not let a caller push to, whatever it was imported as. */
function isReadonlyList(declaration: VariableDeclaration): boolean {
  return isReadonlyType(declaration.type) || isConstAssertion(declaration.initializer);
}

function isConstDeclaration(declaration: Node): boolean {
  const list = declaration.parent;
  return !!list && isVariableDeclarationList(list) && (list.flags & NodeFlags.Const) !== 0;
}

/** Every list `isTolerated` accepts in `source`, sized or `null`, by id. */
function readFile(
  file: string,
  source: SourceFile,
  isTolerated: (name: string) => boolean,
  sizes: ListSizes
): void {
  const scope: FileScope = { stringNames: namesBoundToStrings(source) };
  walk(source, (node) => {
    if (isVariableDeclaration(node)) {
      if (isIdentifier(node.name) && isTolerated(node.name.text)) {
        const id = `${file}#${node.name.text}`;
        const alone = !sizes.has(id) && isConstDeclaration(node) && isReadonlyList(node);
        sizes.set(id, alone ? sizeOf(node.initializer, scope) : null);
      }
    }
  });
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
