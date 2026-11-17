/**
 * The guard sizes the declared literal of each tolerated list and holds that size; it refuses what
 * it cannot size, and mutation after the declaration, by any path, is out of scope and left to
 * review.
 *
 * A list is sized when it is a `const` whose initializer is an array literal or a record literal,
 * and none holds a spread. An array counts its leaf entries, so an array of arrays counts the
 * entries of the inner ones, and an element that is a name or a call counts as 1. A record counts
 * one per property, a property whose value is an array literal counting the entries of that array;
 * any other value counts one only when it is a string, a number, an object literal, or a name
 * bound to a string literal in the same file, so a record refuses a name or a call an array
 * accepts.
 *
 * Refused, as `null`: a non-literal initializer (a `new Set` or `new Map` included), a spread, any
 * record property that is not `key: value`, a record value the reading cannot see into, and a name
 * declared twice in a file. At the head, also a `let` or `var`, and a type that is not
 * `readonly T[]`, `ReadonlyArray` or `Readonly`. The readonly type is shallow: it makes the
 * compiler refuse a `push` through an alias of the list, not a push into a nested array or record
 * value, nor a call that changes a nested collection.
 *
 * Not read: a name bound by a destructuring, and a class static property.
 */
import { tmpdir } from "node:os";
import {
  type ArrayLiteralExpression,
  type Expression,
  isArrayLiteralExpression,
  isIdentifier,
  isNumericLiteral,
  isObjectLiteralExpression,
  isPropertyAssignment,
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
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

/** The entries of each list by id, `<file>#<name>`, or `null` where the list cannot be sized. */
export type ListSizes = Map<string, number | null>;

const VIRTUAL_ROOT = `${tmpdir().replaceAll("\\", "/")}/list-sizes`;
const SINGLE_ENTRY = 1;
const READONLY_TYPES = new Set(["Readonly", "ReadonlyArray"]);

export interface ListSizeOptions {
  /**
   * Refuse a list that is not a readonly `const`. The head requires it; a base revision is sized
   * by its literal alone, so a list that was not readonly there is still held.
   */
  readonly requireReadonly: boolean;
}

/** What a file declares that sizing a list needs to look up. */
interface FileScope {
  /** The names bound to a string literal, which a record value may point at. */
  readonly stringNames: ReadonlySet<string>;
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  node.forEachChild((child) => {
    walk(child, visit);
  });
}

function namesBoundToStrings(source: SourceFile): Set<string> {
  const names = new Set<string>();
  walk(source, (node) => {
    if (
      isVariableDeclaration(node) &&
      isIdentifier(node.name) &&
      node.initializer &&
      isStringLiteral(node.initializer)
    ) {
      names.add(node.name.text);
    }
  });
  return names;
}

function leafEntriesOf(array: ArrayLiteralExpression): number | null {
  let total = 0;
  for (const element of array.elements) {
    if (isSpreadElement(element)) return null;
    const leaves = isArrayLiteralExpression(element) ? leafEntriesOf(element) : SINGLE_ENTRY;
    if (leaves === null) return null;
    total += leaves;
  }
  return total;
}

function isSeenAsOneEntry(value: Expression, scope: FileScope): boolean {
  return (
    isStringLiteral(value) ||
    isNumericLiteral(value) ||
    isObjectLiteralExpression(value) ||
    (isIdentifier(value) && scope.stringNames.has(value.text))
  );
}

function recordSize(properties: readonly Node[], scope: FileScope): number | null {
  let total = 0;
  for (const property of properties) {
    if (!isPropertyAssignment(property)) return null;
    const value = property.initializer;
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

function sizeOf(initializer: Expression | undefined, scope: FileScope): number | null {
  if (!initializer) return null;
  if (isArrayLiteralExpression(initializer)) return leafEntriesOf(initializer);
  return isObjectLiteralExpression(initializer) ? recordSize(initializer.properties, scope) : null;
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

function isConstDeclaration(declaration: Node): boolean {
  const list = declaration.parent;
  return !!list && isVariableDeclarationList(list) && (list.flags & NodeFlags.Const) !== 0;
}

/** Every list `isTolerated` accepts in `source`, sized or `null`, by id. */
function readFile(
  file: string,
  source: SourceFile,
  isTolerated: (name: string) => boolean,
  sizes: ListSizes,
  options: ListSizeOptions
): void {
  const scope: FileScope = { stringNames: namesBoundToStrings(source) };
  walk(source, (node) => {
    if (isVariableDeclaration(node)) {
      if (isIdentifier(node.name) && isTolerated(node.name.text)) {
        const id = `${file}#${node.name.text}`;
        const held =
          !options.requireReadonly || (isConstDeclaration(node) && isReadonlyType(node.type));
        sizes.set(id, !sizes.has(id) && held ? sizeOf(node.initializer, scope) : null);
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
  isTolerated: (name: string) => boolean,
  options: ListSizeOptions
): ListSizes {
  const sizes: ListSizes = new Map();
  const paths = Object.keys(files);
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
      readFile(path, source, isTolerated, sizes, options);
    }
  } finally {
    api.close();
  }
  return sizes;
}
