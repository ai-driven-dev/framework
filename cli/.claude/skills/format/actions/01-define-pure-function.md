# 01 - Define Pure Function

Write a named-export pure function with an explicit TypeScript signature. No I/O, no side
effects, no `any` types.

## Inputs

- `function-name` (required) - string, camelCase name of the function (e.g. `serializeWidgetFrontmatter`)
- `transform` (required) - one sentence describing what the function does to its input string
- `file` (required) - string, target file in `domain/formats/` (e.g. `widget-frontmatter.ts`)

## Outputs

```typescript
// domain/formats/widget-frontmatter.ts

const FRONTMATTER_DELIMITER = "---";

export interface WidgetFrontmatter {
  name: string;
  mode: string;
  version?: string;
}

/**
 * Serializes a WidgetFrontmatter object to a YAML frontmatter block.
 * Inverse: deserializeWidgetFrontmatter
 */
export function serializeWidgetFrontmatter(fm: WidgetFrontmatter): string {
  const lines: string[] = [FRONTMATTER_DELIMITER];
  lines.push(`name: ${fm.name}`);
  lines.push(`mode: ${fm.mode}`);
  if (fm.version !== undefined) lines.push(`version: ${fm.version}`);
  lines.push(FRONTMATTER_DELIMITER);
  return lines.join("\n");
}
```

## Process

1. Create or open `domain/formats/<file>.ts`. If the file exists, add the function; do not overwrite existing exports.
2. Declare module-level constants in `CONSTANT_CASE` for any literal used more than once.
3. Declare input/output types explicitly. No `any`, no implicit `unknown` that narrows to `any`.
4. Write the function body as a pure transformation: input → output, no I/O.
5. Add a JSDoc comment that names the inverse function (`Inverse: <reverse-function-name>`) so consumers can find the round-trip pair.
6. Add a named export — never a default export.

## Test

Run `pnpm typecheck` — exits 0 confirms the function signature is type-correct and the file has no import-cycle violations.
