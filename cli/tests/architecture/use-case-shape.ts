/**
 * The shape a use case holds, read from the syntax tree: one class named after its file with a
 * public `execute`, at most five constructor dependencies, and the tool catalog arriving at
 * construction, never as a method parameter or a property of an options type.
 *
 * Written limits: a class a method instantiates inline is not counted as a dependency; a file that
 * declares no class holds a port or a function and owes no shape.
 */
import {
  type ClassDeclaration,
  isClassDeclaration,
  isConstructorDeclaration,
  isMethodDeclaration,
  isObjectBindingPattern,
  isPropertyDeclaration,
  isPropertySignatureDeclaration,
  isTypeReferenceNode,
  type Node,
  type ParameterDeclaration,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { present } from "../shared/testing/present.js";
import { walk, withVirtualProject } from "./ts-project.js";

const MAX_CONSTRUCTOR_DEPENDENCIES = 5;
const CATALOG = "ToolCatalog";
/** Folders whose use cases answer one question through `execute` alone. */
const ONLY_EXECUTE_HOMES = ["src/contexts/host-registration/application/withdraw/"];

const pascalCase = (kebab: string): string =>
  kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const nameOf = (node: Node): string | undefined => {
  if (!("name" in node)) return undefined;
  const { name } = node;
  return typeof name === "object" &&
    name !== null &&
    "text" in name &&
    typeof name.text === "string"
    ? name.text
    : undefined;
};

const hasModifier = (node: Node, kind: SyntaxKind): boolean => {
  if (!("modifiers" in node) || !Array.isArray(node.modifiers)) return false;
  return node.modifiers.some((m) => m.kind === kind);
};

const isHidden = (node: Node): boolean =>
  hasModifier(node, SyntaxKind.PrivateKeyword) || hasModifier(node, SyntaxKind.ProtectedKeyword);

/** One dependency per parameter, one per name a destructured parameter binds. */
function dependencies(parameters: readonly ParameterDeclaration[]): number {
  return parameters.reduce(
    (total, { name }) => total + (isObjectBindingPattern(name) ? name.elements.length : 1),
    0
  );
}

const NAMED_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;

/** Names the file imports from a `ports` or `contract` folder: an interface a class implements
 * from there names the questions it answers. */
function portNames(source: string): Set<string> {
  return new Set(
    [...source.matchAll(NAMED_IMPORT)]
      .filter((match) => /\/(?:ports|contract)\//.test(match[2] ?? ""))
      .flatMap((match) => (match[1] ?? "").split(","))
      .map((name) => (name.split(/\sas\s/).pop() ?? "").replace(/^\s*type\s+/, "").trim())
  );
}

function implementsPort(declaration: ClassDeclaration, ports: ReadonlySet<string>): boolean {
  return (declaration.heritageClauses ?? []).some(
    (clause) =>
      clause.token === SyntaxKind.ImplementsKeyword &&
      clause.types.some((type) => ports.has(type.expression.getText().replace(/<.*$/s, "")))
  );
}

function breaksOf(file: string, source: string, root: SourceFile): string[] {
  const breaks: string[] = [];
  const classes = root.statements.filter(isClassDeclaration);
  if (classes.length > 0) {
    const methods = classes.flatMap((declaration) =>
      declaration.members.filter(isMethodDeclaration)
    );
    const execute = methods.filter((method) => nameOf(method) === "execute");
    const publicMethods = methods.filter(
      (method) => !isHidden(method) && !hasModifier(method, SyntaxKind.StaticKeyword)
    );
    const ports = portNames(source);
    if (execute.length > 0) {
      const expected = pascalCase(file.replace(/^.*\//, "").replace(/\.ts$/, ""));
      if (classes.length !== 1) breaks.push(`${classes.length} classes, expected one`);
      if (!classes.some((declaration) => nameOf(declaration) === expected))
        breaks.push(`no class named ${expected}`);
      if (execute.some(isHidden)) breaks.push("an execute that is not public");
      const others = publicMethods.map(nameOf).filter((name) => name !== "execute");
      if (ONLY_EXECUTE_HOMES.some((home) => file.startsWith(home)) && others.length > 0)
        breaks.push(`public methods besides execute: ${others.join(", ")}`);
    } else if (
      publicMethods.length > 1 &&
      !classes.some((declaration) => implementsPort(declaration, ports))
    ) {
      breaks.push(`${publicMethods.length} public methods and no execute`);
    }
    for (const declaration of classes) {
      const constructors = declaration.members.filter(isConstructorDeclaration);
      const widest = Math.max(0, ...constructors.map((c) => dependencies(c.parameters)));
      if (widest > MAX_CONSTRUCTOR_DEPENDENCIES)
        breaks.push(`${widest} constructor dependencies, at most ${MAX_CONSTRUCTOR_DEPENDENCIES}`);
    }
  }
  walk(root, (node) => {
    if (!isTypeReferenceNode(node)) return;
    const name = node.typeName.getText();
    const asked =
      name === CATALOG || (name === "Pick" && node.typeArguments?.[0]?.getText() === CATALOG);
    if (!asked) return;
    let at: Node | undefined = node.parent;
    while (at !== undefined) {
      if (isConstructorDeclaration(at)) return;
      if (isMethodDeclaration(at))
        return void breaks.push("takes the tool catalog as a method parameter");
      if (isPropertySignatureDeclaration(at) || isPropertyDeclaration(at))
        return void breaks.push("carries the tool catalog as a property");
      at = at.parent;
    }
  });
  return breaks;
}

/** The use-case files that break the shape, one entry per file. */
export function useCaseShapeBreaks(files: Readonly<Record<string, string>>): Map<string, string[]> {
  if (Object.keys(files).length === 0) return new Map();
  return withVirtualProject(
    "use-case-shapes",
    files,
    { module: "esnext", target: "esnext" },
    (project, at) => {
      const found = new Map<string, string[]>();
      for (const [file, text] of Object.entries(files)) {
        const source = project.program.getSourceFile(at(file));
        if (!source) throw new Error(`the compiler returned no source for ${file}`);
        const breaks = breaksOf(file, present(text), source);
        if (breaks.length > 0) found.set(file, [...new Set(breaks)]);
      }
      return found;
    }
  );
}
