/**
 * The guard sizes the declared literal of each tolerated list and holds that size; it refuses what
 * it cannot size.
 *
 * A list is sized when its initializer is an array literal or a record literal,
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
 *
 * `listWeights` reads the numbers a list records (a line count, a dependency count), one per
 * entry that holds a numeric literal, summed inside the entry. The key of an entry is its record
 * property name, or the string of its `path`, `file` or `edge` field. A numbered entry with no key
 * leaves the list unreadable, `null`. Limit: a moved file reads as a new key, so a new key is not
 * checked; swapping one fixed entry for a new one at equal count is left to review.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import { walk, withVirtualProject } from "./ts-project.js";

export const ARCHITECTURE_DIRECTORY = "tests/architecture";

/** Shrink-only lists whose name does not say so. Register a list here by name, never by content. */
export const OTHER_TOLERATED_LISTS: ReadonlySet<string> = new Set([
  "TRANSITIONAL_PAIRS",
  "STORED_ANSWERS_ALLOWED",
  "PROFILE_READERS_ALLOWED",
  "REGISTRATION_SITES",
  "OWN_TOOL_FILES",
]);

/** A tolerated list is any variable whose name holds `BASELINE`, plus `OTHER_TOLERATED_LISTS`. */
export function isToleratedList(name: string): boolean {
  return name.includes("BASELINE") || OTHER_TOLERATED_LISTS.has(name);
}

/** The architecture sources in the working tree of the `cli` directory at `cliRoot`. */
export function filesOnDisk(cliRoot: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(join(cliRoot, ARCHITECTURE_DIRECTORY), { recursive: true, encoding: "utf8" })
      .map((name) => `${ARCHITECTURE_DIRECTORY}/${name.replaceAll("\\", "/")}`)
      .filter((path) => path.endsWith(".ts"))
      .map((path) => [path, readFileSync(join(cliRoot, path), "utf8")])
  );
}

/** The entries of each list by id, `<file>#<name>`, or `null` where the list cannot be sized. */
export type ListSizes = Map<string, number | null>;

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

/** Writes what the list `id` measures into `out`; `initializer` is absent where it is not held. */
type Measure = (
  out: ListSizes,
  id: string,
  initializer: Expression | undefined,
  scope: FileScope
) => void;

const sizeMeasure: Measure = (out, id, initializer, scope) =>
  out.set(id, initializer ? sizeOf(initializer, scope) : null);

const ENTRY_KEY_FIELDS = new Set(["path", "file", "edge"]);

function propertyKey(name: Node): string | null {
  return isIdentifier(name) || isStringLiteral(name) ? name.text : null;
}

function numbersIn(node: Node): number {
  let total = 0;
  walk(node, (inner) => {
    if (isNumericLiteral(inner)) total += Number(inner.text);
  });
  return total;
}

/** The key of an array entry: the string its `path`, `file` or `edge` field holds. */
function entryKeyOf(element: Node): string | null {
  if (!isObjectLiteralExpression(element)) return null;
  for (const property of element.properties) {
    if (!isPropertyAssignment(property)) continue;
    const key = propertyKey(property.name);
    if (key !== null && ENTRY_KEY_FIELDS.has(key) && isStringLiteral(property.initializer)) {
      return property.initializer.text;
    }
  }
  return null;
}

/** An entry that records a number, by its key, or `null` when the number has no key to hold. */
function numberedEntries(initializer: Expression): [string, number][] | null {
  const entries: [string, number][] = [];
  const elements: readonly Node[] = isArrayLiteralExpression(initializer)
    ? initializer.elements
    : isObjectLiteralExpression(initializer)
      ? initializer.properties
      : [];
  for (const element of elements) {
    const weight = numbersIn(element);
    if (weight === 0) continue;
    const key = isPropertyAssignment(element) ? propertyKey(element.name) : entryKeyOf(element);
    if (key === null) return null;
    entries.push([key, weight]);
  }
  return entries;
}

const weightMeasure: Measure = (out, id, initializer, scope) => {
  const entries =
    initializer && sizeOf(initializer, scope) !== null ? numberedEntries(initializer) : null;
  if (entries === null) out.set(id, null);
  else for (const [key, weight] of entries) out.set(`${id}#${key}`, weight);
};

/** Every list `isTolerated` accepts in `source`, measured or `null`, by id. */
function readFile(
  file: string,
  source: SourceFile,
  isTolerated: (name: string) => boolean,
  sizes: ListSizes,
  options: ListSizeOptions,
  measure: Measure
): void {
  const scope: FileScope = { stringNames: namesBoundToStrings(source) };
  walk(source, (node) => {
    if (isVariableDeclaration(node)) {
      if (isIdentifier(node.name) && isTolerated(node.name.text)) {
        const id = `${file}#${node.name.text}`;
        const held =
          !options.requireReadonly || (isConstDeclaration(node) && isReadonlyType(node.type));
        measure(sizes, id, !sizes.has(id) && held ? node.initializer : undefined, scope);
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
  return measureLists(files, isTolerated, options, sizeMeasure);
}

/**
 * The number each entry of a list records, by `<list id>#<entry key>`. A list that cannot be sized,
 * or whose numbered entry has no key, is `null` under its own id.
 */
export function listWeights(
  files: Readonly<Record<string, string>>,
  isTolerated: (name: string) => boolean,
  options: ListSizeOptions
): ListSizes {
  return measureLists(files, isTolerated, options, weightMeasure);
}

function measureLists(
  files: Readonly<Record<string, string>>,
  isTolerated: (name: string) => boolean,
  options: ListSizeOptions,
  measure: Measure
): ListSizes {
  const sizes: ListSizes = new Map();
  withVirtualProject(
    "list-sizes",
    files,
    { noLib: true, noResolve: true, types: [] },
    (project, at) => {
      for (const path of Object.keys(files)) {
        const source = project.program.getSourceFile(at(path));
        if (!source) throw new Error(`the compiler returned no source for ${path}`);
        readFile(path, source, isTolerated, sizes, options, measure);
      }
    }
  );
  return sizes;
}
