/**
 * What every rule of the kind gate shares: the violation it reports, the syntax tree of each file it
 * reads, and the two readings of a node (a name, a literal) several rules make.
 */
import {
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  isPropertyAccessExpression,
  isStringLiteral,
  isTemplateExpression,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import type { Rule, Violation } from "./kinds.js";
import { walk, withVirtualProject } from "./ts-project.js";

export const violation = (
  rule: Rule,
  entry: string,
  what: string,
  law: string,
  fix: string
): Violation => ({
  rule,
  entry,
  message: `${entry}: ${what}. Rule: ${law} (tests/architecture/kind-rules.ts). Fix: ${fix}.`,
});

/** The syntax tree of each file, read by `read`, which returns what it found in that file. */
export function readEach<T>(
  files: Readonly<Record<string, string>>,
  read: (path: string, root: SourceFile) => T[]
): T[] {
  if (Object.keys(files).length === 0) return [];
  return withVirtualProject(
    "kind-rules",
    files,
    { module: "esnext", target: "esnext" },
    (project, at) =>
      Object.keys(files).flatMap((path) => {
        const root = project.program.getSourceFile(at(path));
        if (!root) throw new Error(`the compiler returned no source for ${path}`);
        return read(path, root);
      })
  );
}

export const nameText = (node: Node): string | undefined =>
  isIdentifier(node) ? node.text : isPropertyAccessExpression(node) ? node.name.text : undefined;

/** Every piece of text a string literal or a template holds; a comment is never one. */
export function literalsOf(root: SourceFile): string[] {
  const found: string[] = [];
  walk(root, (node) => {
    if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) found.push(node.text);
    else if (isTemplateExpression(node)) {
      found.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text));
    }
  });
  return found;
}
