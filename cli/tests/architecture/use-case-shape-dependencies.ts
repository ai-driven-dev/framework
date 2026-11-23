/**
 * How many dependencies a constructor takes, read through the type checker so a bag counts by its
 * fields wherever its type is declared, through `extends` and intersections.
 *
 * A parameter counts as one dependency, unless its type is a plain object: no method, no call or
 * construct signature, not a class. Then each of its fields counts, and a field whose type is
 * itself such an object declared by a use-case file (a nested bag) counts by its own fields. A set
 * of functions is a collaborator, unless an application folder declares it: then it is a bag. A
 * destructured parameter counts each name it binds the same way.
 *
 * Written limit: a field typed by a port, model or contract type is one collaborator or one value,
 * whatever its fields, so a value object such as a build layout is never expanded. An object with a
 * method is a collaborator wherever it is declared.
 */
import {
  isObjectBindingPattern,
  type Node,
  type ParameterDeclaration,
} from "typescript/unstable/ast";
import { type Checker, SignatureKind, SymbolFlags, type Type } from "typescript/unstable/sync";

/** Where the reader finds a type's checker and tells where a file sits from its path. */
export interface DependencyReader {
  readonly checker: Checker;
  /** Whether the file at this absolute path is a use case. */
  readonly declaredByUseCase: (path: string) => boolean;
  /** Whether the file at this absolute path sits in a context's application folder. */
  readonly declaredByApplication: (path: string) => boolean;
}

const MAX_DEPTH = 4;

const defined = (checker: Checker, type: Type): Type => checker.getNonNullableType(type) ?? type;

const callable = (checker: Checker, type: Type): boolean =>
  checker.getSignaturesOfType(defined(checker, type), SignatureKind.Call).length > 0;

const fieldTypes = (checker: Checker, type: Type): Type[] =>
  checker.getPropertiesOfType(type).map((field) => {
    const found = checker.getTypeOfSymbol(field);
    if (!found) throw new Error(`the checker returned no type for the field ${field.name}`);
    return found;
  });

/** A type that answers questions itself: a function, a class, an object with a method, or a
 * function-only object that no application folder declares. */
function isCollaborator(reader: DependencyReader, type: Type): boolean {
  const { checker } = reader;
  if (callable(checker, type)) return true;
  if (checker.getSignaturesOfType(type, SignatureKind.Construct).length > 0) return true;
  if ((type.getSymbol()?.flags ?? 0) & SymbolFlags.Class) return true;
  const fields = checker.getPropertiesOfType(type);
  if (fields.some((field) => field.flags & SymbolFlags.Method)) return true;
  const types = fieldTypes(checker, type);
  return (
    types.length > 0 &&
    types.every((field) => callable(checker, field)) &&
    !declaredBy(reader.declaredByApplication, type)
  );
}

const isPlain = (reader: DependencyReader, type: Type): boolean =>
  !type.isUnionType() &&
  (type.isObjectType() || type.isIntersectionType()) &&
  !isCollaborator(reader, type) &&
  reader.checker.getPropertiesOfType(type).length > 0;

function declaredBy(sits: (path: string) => boolean, type: Type): boolean {
  if (type.isIntersectionType())
    return (type.getTypes() ?? []).every((part) => declaredBy(sits, part));
  const declarations = (type.getAliasSymbol() ?? type.getSymbol())?.declarations ?? [];
  return (
    declarations.length > 0 && declarations.every((declaration) => sits(String(declaration.path)))
  );
}

function countOf(reader: DependencyReader, raw: Type, depth: number): number {
  const { checker } = reader;
  const type = defined(checker, raw);
  if (type.isErrorType())
    throw new Error(`an unresolved dependency type: ${checker.typeToString(raw)}`);
  const bag = isPlain(reader, type) && (depth === 0 || declaredBy(reader.declaredByUseCase, type));
  if (!bag || depth > MAX_DEPTH) return 1;
  return fieldTypes(checker, type).reduce(
    (total, field) => total + countOf(reader, field, depth + 1),
    0
  );
}

const typeAt = (checker: Checker, node: Node): Type => {
  const type = checker.getTypeAtLocation(node);
  if (!type) throw new Error(`the checker returned no type for ${node.getText()}`);
  return type;
};

/** One dependency per parameter, per name a destructured parameter binds, per field of a bag. */
export function dependencyCount(
  reader: DependencyReader,
  parameters: readonly ParameterDeclaration[]
): number {
  return parameters.reduce((total, parameter) => {
    const { name } = parameter;
    if (!isObjectBindingPattern(name))
      return total + countOf(reader, typeAt(reader.checker, parameter), 0);
    return name.elements.reduce(
      (sum, element) => sum + countOf(reader, typeAt(reader.checker, element), 1),
      total
    );
  }, 0);
}

/** One dependency per field of a bag the project declares, counted as a constructor counts it. */
export function bagCount(reader: DependencyReader, declaration: Node): number {
  return countOf(reader, typeAt(reader.checker, declaration), 0);
}
