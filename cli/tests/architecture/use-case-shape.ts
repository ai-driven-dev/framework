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
  isInterfaceDeclaration,
  isMethodDeclaration,
  isObjectBindingPattern,
  isPropertyDeclaration,
  isPropertySignatureDeclaration,
  isTypeAliasDeclaration,
  isTypeLiteralNode,
  isTypeReferenceNode,
  type Node,
  type ParameterDeclaration,
  type SourceFile,
  SyntaxKind,
  type TypeReferenceNode,
} from "typescript/unstable/ast";
import { present } from "../shared/testing/present.builder.js";
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

/** The fields of the interface or object type `name`, when the file declares it. */
function fieldsOf(root: SourceFile, name: string): number | undefined {
  for (const statement of root.statements) {
    if (isInterfaceDeclaration(statement) && nameOf(statement) === name)
      return statement.members.length;
    if (
      isTypeAliasDeclaration(statement) &&
      nameOf(statement) === name &&
      isTypeLiteralNode(statement.type)
    )
      return statement.type.members.length;
  }
  return undefined;
}

/** One dependency per parameter, one per name a destructured parameter binds, one per field of a
 * bag the file declares. */
function dependencies(root: SourceFile, parameters: readonly ParameterDeclaration[]): number {
  return parameters.reduce((total, { name, type }) => {
    if (isObjectBindingPattern(name)) return total + name.elements.length;
    const bag =
      type !== undefined && isTypeReferenceNode(type)
        ? fieldsOf(root, type.typeName.getText())
        : undefined;
    return total + (bag ?? 1);
  }, 0);
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

/** What is wrong with the use case that has an `execute`. */
function executeBreaks(
  file: string,
  classes: readonly ClassDeclaration[],
  execute: readonly Node[],
  publicMethods: readonly Node[]
): string[] {
  const breaks: string[] = [];
  const expected = pascalCase(file.replace(/^.*\//, "").replace(/(?:\.use-case)?\.ts$/, ""));
  if (classes.length !== 1) breaks.push(`${classes.length} classes, expected one`);
  if (!classes.some((declaration) => nameOf(declaration) === expected))
    breaks.push(`no class named ${expected}`);
  if (execute.some(isHidden)) breaks.push("an execute that is not public");
  const others = publicMethods.map(nameOf).filter((name) => name !== "execute");
  if (ONLY_EXECUTE_HOMES.some((home) => file.startsWith(home)) && others.length > 0)
    breaks.push(`public methods besides execute: ${others.join(", ")}`);
  return breaks;
}

/** What is wrong with the public methods of the classes of a file. */
function methodBreaks(
  file: string,
  source: string,
  classes: readonly ClassDeclaration[]
): string[] {
  const methods = classes.flatMap((declaration) => declaration.members.filter(isMethodDeclaration));
  const execute = methods.filter((method) => nameOf(method) === "execute");
  const publicMethods = methods.filter(
    (method) => !isHidden(method) && !hasModifier(method, SyntaxKind.StaticKeyword)
  );
  if (execute.length > 0) return executeBreaks(file, classes, execute, publicMethods);
  const ports = portNames(source);
  const unported = !classes.some((declaration) => implementsPort(declaration, ports));
  return publicMethods.length > 1 && unported
    ? [`${publicMethods.length} public methods and no execute`]
    : [];
}

function constructorBreaks(root: SourceFile, classes: readonly ClassDeclaration[]): string[] {
  return classes.flatMap((declaration) => {
    const constructors = declaration.members.filter(isConstructorDeclaration);
    const widest = Math.max(0, ...constructors.map((c) => dependencies(root, c.parameters)));
    return widest > MAX_CONSTRUCTOR_DEPENDENCIES
      ? [`${widest} constructor dependencies, at most ${MAX_CONSTRUCTOR_DEPENDENCIES}`]
      : [];
  });
}

const asksForCatalog = (node: TypeReferenceNode): boolean => {
  const name = node.typeName.getText();
  return name === CATALOG || (name === "Pick" && node.typeArguments?.[0]?.getText() === CATALOG);
};

/** What the declaration that holds a catalog type reference breaks, when it is not a constructor. */
function catalogHolderBreaks(node: Node): string[] {
  for (let at = node.parent; at !== undefined; at = at.parent) {
    if (isConstructorDeclaration(at)) return [];
    if (isMethodDeclaration(at)) return ["takes the tool catalog as a method parameter"];
    if (isPropertySignatureDeclaration(at) || isPropertyDeclaration(at))
      return ["carries the tool catalog as a property"];
  }
  return [];
}

function catalogBreaks(root: SourceFile): string[] {
  const breaks: string[] = [];
  walk(root, (node) => {
    if (isTypeReferenceNode(node) && asksForCatalog(node))
      breaks.push(...catalogHolderBreaks(node));
  });
  return breaks;
}

function breaksOf(file: string, source: string, root: SourceFile): string[] {
  const classes = root.statements.filter(isClassDeclaration);
  const inClasses =
    classes.length > 0
      ? [...methodBreaks(file, source, classes), ...constructorBreaks(root, classes)]
      : [];
  return [...inClasses, ...catalogBreaks(root)];
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

/** Where a class with a public `execute` is a use case, and so is named by its file. */
export const holdsUseCases = (path: string): boolean =>
  path.startsWith("src/orchestration/") || path.includes("/application/");

const exportsExecutingClass = (root: SourceFile): boolean =>
  root.statements
    .filter(isClassDeclaration)
    .filter((declaration) => hasModifier(declaration, SyntaxKind.ExportKeyword))
    .some((declaration) =>
      declaration.members
        .filter(isMethodDeclaration)
        .some(
          (method) =>
            nameOf(method) === "execute" &&
            !isHidden(method) &&
            !hasModifier(method, SyntaxKind.StaticKeyword)
        )
    );

/** The files that export a class with a public `execute` and do not end in the use-case suffix. */
export function useCaseFilesWithoutSuffix(files: Readonly<Record<string, string>>): string[] {
  const candidates = Object.fromEntries(
    Object.entries(files).filter(([file]) => holdsUseCases(file) && !file.endsWith(".use-case.ts"))
  );
  if (Object.keys(candidates).length === 0) return [];
  return withVirtualProject(
    "use-case-suffixes",
    candidates,
    { module: "esnext", target: "esnext" },
    (project, at) =>
      Object.keys(candidates).filter((file) => {
        const source = project.program.getSourceFile(at(file));
        if (!source) throw new Error(`the compiler returned no source for ${file}`);
        return exportsExecutingClass(source);
      })
  );
}
