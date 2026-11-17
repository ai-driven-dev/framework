/**
 * The size of the lists a set of TypeScript files declares, read from the syntax tree the compiler
 * builds and not from text, so a declaration is seen wherever it sits: after a comment, as the
 * second declarator of a statement, inside a function.
 *
 * Every variable declaration is visited, whatever its keyword. A list is sized when its
 * initializer is an array literal, a record literal, or a `new Set` or `new Map` over an array
 * literal, and none holds a spread. A record counts one per property, a property whose value is
 * an array literal counting the entries of that array. Anything else, and a name declared twice
 * in a file or bound by a destructuring, is `null`: a list that cannot be sized cannot be held.
 */
import { tmpdir } from "node:os";
import {
  type ArrayLiteralExpression,
  type BindingName,
  type Expression,
  isArrayLiteralExpression,
  isAsExpression,
  isBindingElement,
  isIdentifier,
  isNewExpression,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
  isSpreadAssignment,
  isSpreadElement,
  isVariableDeclaration,
  type Node,
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

/** The entries of each list by id, `<file>#<name>`, or `null` where the list cannot be sized. */
export type ListSizes = Map<string, number | null>;

const VIRTUAL_ROOT = `${tmpdir().replaceAll("\\", "/")}/list-sizes`;
const SET_OR_MAP = new Set(["Set", "Map"]);

function unwrap(expression: Expression): Expression {
  return isAsExpression(expression) ||
    isSatisfiesExpression(expression) ||
    isParenthesizedExpression(expression)
    ? unwrap(expression.expression)
    : expression;
}

function arrayLength(array: ArrayLiteralExpression): number | null {
  return array.elements.some(isSpreadElement) ? null : array.elements.length;
}

function recordSize(properties: readonly Node[]): number | null {
  let total = 0;
  for (const property of properties) {
    if (isSpreadAssignment(property)) return null;
    const value = isPropertyAssignment(property) ? unwrap(property.initializer) : undefined;
    const entries = value && isArrayLiteralExpression(value) ? arrayLength(value) : 1;
    if (entries === null) return null;
    total += entries;
  }
  return total;
}

function sizeOf(initializer: Expression | undefined): number | null {
  if (!initializer) return null;
  const value = unwrap(initializer);
  if (isArrayLiteralExpression(value)) return arrayLength(value);
  if (isObjectLiteralExpression(value)) return recordSize(value.properties);
  if (isNewExpression(value) && isIdentifier(value.expression)) {
    const [argument, ...others] = value.arguments ?? [];
    const array = argument && unwrap(argument);
    return SET_OR_MAP.has(value.expression.text) &&
      array &&
      isArrayLiteralExpression(array) &&
      others.length === 0
      ? arrayLength(array)
      : null;
  }
  return null;
}

function boundNames(name: BindingName): string[] {
  if (isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    isBindingElement(element) && element.name ? boundNames(element.name) : []
  );
}

/** Every declaration of a name `isTolerated` accepts under `node`, at any depth. */
function collect(
  file: string,
  node: Node,
  isTolerated: (name: string) => boolean,
  sizes: ListSizes
): void {
  if (isVariableDeclaration(node)) {
    for (const name of boundNames(node.name).filter(isTolerated)) {
      const id = `${file}#${name}`;
      const alone = isIdentifier(node.name) && !sizes.has(id);
      sizes.set(id, alone ? sizeOf(node.initializer) : null);
    }
  }
  node.forEachChild((child) => {
    collect(file, child, isTolerated, sizes);
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
      if (source) collect(path, source, isTolerated, sizes);
    }
  } finally {
    api.close();
  }
  return sizes;
}
