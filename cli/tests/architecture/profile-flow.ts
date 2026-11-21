/**
 * Where a whole tool profile flows into a parameter that is typed as the whole profile.
 *
 * A reader that never names `AiToolProfile` can still be coupled to all of it: it asks the catalog
 * for a profile and hands that profile to a callee whose parameter is the whole profile. The
 * import-based reading cannot see that file, so this one asks the compiler. A profile expression
 * (an identifier or a call whose type is a whole-profile type) is a hit when it is an argument of
 * a call or a `new`, directly or inside an object or array literal argument, and the type the
 * parameter asks for is a whole-profile type too.
 *
 * A hit is skipped when the callee is declared in a file the caller lists as exempt: the debt of
 * handing a whole profile on belongs to that listed file, and callers of it are not new coupling.
 * A listed file may keep adding whole-profile functions, and new callers of those pass silently:
 * the debt stays with the listed file.
 *
 * Written limits: a return, an assignment and a field initializer are not read, only an argument;
 * a call whose signature is generic is skipped, because the compiler infers its parameter type
 * from the argument and the answer would be the argument's own type; a profile that may be absent
 * (`AiToolProfile | undefined`) and an optional profile parameter are not followed; and the
 * caller names the files to read, so a file the caller leaves out is not seen.
 */
import {
  type CallExpression,
  type Identifier,
  isCallExpression,
  isIdentifier,
  isInterfaceDeclaration,
  isSourceFile,
  isTypeAliasDeclaration,
  type Node,
  SyntaxKind,
} from "typescript/unstable/ast";
import type { Project, Type } from "typescript/unstable/sync";
import { walk, withRealProject, withVirtualProject } from "./ts-project.js";

/** The types that are the whole profile, declared in the profile module. */
const WHOLE_PROFILE_TYPES = ["AiToolProfile", "IdeToolProfile", "ToolProfile"];

const LITERAL_WRAPPERS = new Set([
  SyntaxKind.ObjectLiteralExpression,
  SyntaxKind.ArrayLiteralExpression,
  SyntaxKind.PropertyAssignment,
  SyntaxKind.ShorthandPropertyAssignment,
  SyntaxKind.ParenthesizedExpression,
  SyntaxKind.SpreadElement,
]);

const isCallOrNew = (node: Node): boolean =>
  isCallExpression(node) || node.kind === SyntaxKind.NewExpression;

/** The call `parent` is, when `child` is one of its arguments and not what it calls. */
function callTakingAsArgument(parent: Node, child: Node): Node | null {
  const calledOn = "expression" in parent ? parent.expression : undefined;
  return isCallOrNew(parent) && calledOn !== child ? parent : null;
}

/** The call or `new` the expression is an argument of, through any literal wrapping it. */
function enclosingCall(node: Node): Node | null {
  let child = node;
  for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (LITERAL_WRAPPERS.has(parent.kind)) continue;
    return callTakingAsArgument(parent, child);
  }
  return null;
}

/** The path, relative to the project root, of the file that declares the called signature. */
function declaringFile(project: Project, call: Node, root: string): string | undefined {
  const declaration = project.checker.getResolvedSignature(call)?.declaration?.resolve(project);
  let node = declaration;
  while (node && !isSourceFile(node)) node = node.parent;
  const name = node?.fileName;
  return name?.startsWith(root) ? name.slice(root.length) : undefined;
}

/** What one read of a project needs to tell a whole-profile flow from any other. */
interface Reading {
  project: Project;
  isWhole: (type: Type | undefined) => boolean;
  exemptCallees: readonly string[];
  root: string;
}

/** The ids of the whole-profile types the profile module declares. */
function wholeProfileTypeIds(project: Project, declaration: Node, profileModule: string) {
  const whole = new Set<number>();
  walk(declaration, (node) => {
    const declaresWhole =
      (isInterfaceDeclaration(node) || isTypeAliasDeclaration(node)) &&
      WHOLE_PROFILE_TYPES.includes(node.name.text);
    const type = declaresWhole ? project.checker.getTypeAtLocation(node.name) : undefined;
    if (type) whole.add(type.id);
  });
  if (whole.size !== WHOLE_PROFILE_TYPES.length) {
    throw new Error(`${profileModule} declares ${whole.size} of the whole-profile types`);
  }
  return whole;
}

/** Whether the expression, of the given type, is a whole profile handed to a whole-profile
 * parameter of a callee that is not exempt. */
function handsWholeProfileOn(
  reading: Reading,
  expression: CallExpression | Identifier,
  type: Type | undefined
): boolean {
  if (!reading.isWhole(type)) return false;
  const call = enclosingCall(expression);
  if (call === null) return false;
  const { checker } = reading.project;
  const signature = checker.getResolvedSignature(call);
  if (signature === undefined || signature.target !== undefined) return false;
  if (!reading.isWhole(checker.getContextualType(expression))) return false;
  const callee = declaringFile(reading.project, call, reading.root) ?? "";
  return !reading.exemptCallees.includes(callee);
}

function fileHandsWholeProfileOn(reading: Reading, source: Node): boolean {
  const expressions: (CallExpression | Identifier)[] = [];
  walk(source, (node) => {
    if (isIdentifier(node) || isCallExpression(node)) expressions.push(node);
  });
  const types = reading.project.checker.getTypeAtLocation(expressions);
  return expressions.some((expression, index) =>
    handsWholeProfileOn(reading, expression, types[index])
  );
}

function flowsIn(
  project: Project,
  profileModule: string,
  files: readonly string[],
  exemptCallees: readonly string[],
  at: (path: string) => string
): string[] {
  const { program } = project;
  const declaration = program.getSourceFile(at(profileModule));
  if (!declaration) throw new Error(`the compiler returned no source for ${profileModule}`);
  const whole = wholeProfileTypeIds(project, declaration, profileModule);
  const reading: Reading = {
    project,
    isWhole: (type) => type !== undefined && whole.has(type.id),
    exemptCallees,
    root: at(""),
  };
  return files.filter((file) => {
    const source = program.getSourceFile(at(file));
    if (!source) throw new Error(`the compiler returned no source for ${file}`);
    return fileHandsWholeProfileOn(reading, source);
  });
}

/**
 * The files among `files` that pass a whole profile into a whole-profile parameter, read from the
 * project at `cwd` through its `tsconfig.json`. Paths are relative to `cwd`; a callee declared in
 * one of `exemptCallees` is not a hit.
 */
export function wholeProfileFlows(
  cwd: string,
  profileModule: string,
  files: readonly string[],
  exemptCallees: readonly string[]
): string[] {
  // The compiler names its files with forward slashes, a Windows cwd included.
  const root = cwd.replaceAll("\\", "/");
  return withRealProject(cwd, (project) =>
    flowsIn(project, profileModule, files, exemptCallees, (path) => `${root}/${path}`)
  );
}

/** The same reading over a small project given as text: `sources` maps each path to its text. */
export function wholeProfileFlowsInSources(
  sources: Readonly<Record<string, string>>,
  profileModule: string,
  files: readonly string[],
  exemptCallees: readonly string[]
): string[] {
  return withVirtualProject(
    "profile-flow",
    sources,
    { noLib: true, types: [], module: "esnext", moduleResolution: "bundler" },
    (project, at) => flowsIn(project, profileModule, files, exemptCallees, at)
  );
}

const OWNER_OR_WIRING = /^src\/(contexts\/tools\/|composition\/)/;
export const PROFILE_MODULE_FILE = "src/contexts/tools/contract/tool-profile.ts";

/** The catalog methods that answer a whole profile. */
export const CATALOG_PROFILE_METHODS = ["profile", "aiProfile", "ideProfile", "aiProfileIfAny"];
const CATALOG_PROFILE_CALL = new RegExp(String.raw`\.(?:${CATALOG_PROFILE_METHODS.join("|")})\(`);
/** An import of the profile module under a `biome-ignore lint/plugin` comment: a file that hands the profile on. */
export const HANDS_PROFILE_ON =
  /biome-ignore lint\/plugin:[^\n]*\n(?:import|export)[^;]*tools\/contract\/tool-profile\.js/;

/** The files of `texts` outside the tools context and the composition root that call a catalog
 * profile method, and the files among them that hand the profile on. */
export function profileReaders(texts: Readonly<Record<string, string>>): {
  readers: string[];
  handsOn: string[];
} {
  const watched = Object.keys(texts).filter((file) => !OWNER_OR_WIRING.test(file));
  return {
    readers: watched.filter((file) => CATALOG_PROFILE_CALL.test(texts[file] ?? "")),
    handsOn: watched.filter((file) => HANDS_PROFILE_ON.test(texts[file] ?? "")),
  };
}
