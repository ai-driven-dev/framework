/**
 * How many dependencies a constructor takes, read through the type checker so a bag counts by its
 * fields wherever its type is declared, through `extends` and intersections.
 *
 * A parameter counts as one dependency, unless its type is a plain object: no method, no call or
 * construct signature, not a class, not a set of functions. Then each of its fields counts, and a
 * field whose type is itself a plain object declared by a use-case file (a nested bag) counts by its
 * own fields. A destructured parameter counts each name it binds the same way.
 *
 * Written limit: a field typed by a port, model or contract type is one collaborator or one value,
 * whatever its fields, so a value object such as a build layout is never expanded.
 */
import {
  isObjectBindingPattern,
  type Node,
  type ParameterDeclaration,
} from "typescript/unstable/ast";
import { type Checker, SignatureKind, SymbolFlags, type Type } from "typescript/unstable/sync";

/** Where the reader finds a type's checker and tells a use-case file from its path. */
export interface DependencyReader {
  readonly checker: Checker;
  /** Whether the file at this absolute path is a use case. */
  readonly declaredByUseCase: (path: string) => boolean;
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

/** A type that answers questions itself: a function, a class, an object with a method, or an
 * object whose every field is a function. */
function isCollaborator(checker: Checker, type: Type): boolean {
  if (callable(checker, type)) return true;
  if (checker.getSignaturesOfType(type, SignatureKind.Construct).length > 0) return true;
  if ((type.getSymbol()?.flags ?? 0) & SymbolFlags.Class) return true;
  const fields = checker.getPropertiesOfType(type);
  if (fields.some((field) => field.flags & SymbolFlags.Method)) return true;
  const types = fieldTypes(checker, type);
  return types.length > 0 && types.every((field) => callable(checker, field));
}

const isPlain = (checker: Checker, type: Type): boolean =>
  !type.isUnionType() &&
  (type.isObjectType() || type.isIntersectionType()) &&
  !isCollaborator(checker, type) &&
  checker.getPropertiesOfType(type).length > 0;

function declaredByUseCase(reader: DependencyReader, type: Type): boolean {
  if (type.isIntersectionType())
    return (type.getTypes() ?? []).every((part) => declaredByUseCase(reader, part));
  const declarations = (type.getAliasSymbol() ?? type.getSymbol())?.declarations ?? [];
  return (
    declarations.length > 0 &&
    declarations.every((declaration) => reader.declaredByUseCase(String(declaration.path)))
  );
}

function countOf(reader: DependencyReader, raw: Type, depth: number): number {
  const { checker } = reader;
  const type = defined(checker, raw);
  if (type.isErrorType())
    throw new Error(`an unresolved dependency type: ${checker.typeToString(raw)}`);
  const bag = isPlain(checker, type) && (depth === 0 || declaredByUseCase(reader, type));
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
