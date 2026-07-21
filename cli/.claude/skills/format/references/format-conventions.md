# Reference: Format Conventions

## File placement

Format modules live in `domain/formats/`. One concept per file. File name is `<concept>.ts`:

| File                    | Responsibility                                      |
| ----------------------- | --------------------------------------------------- |
| `markdown.ts`           | Frontmatter parsing and serialization               |
| `toml.ts`               | TOML serialization for agent configs                |
| `json.ts`               | JSON serialization helpers                          |
| `placeholders.ts`       | Base `rewriteContent` / `reverseRewriteContent`     |
| `command.ts`            | Command frontmatter conversion and suffix stripping |

New modules follow the same pattern: name the file after the concept it transforms.

## Function naming

- Forward transform: `serialize<Concept>`, `convert<Concept>`, or a descriptive verb phrase.
- Inverse transform: `deserialize<Concept>`, `reverse<FunctionName>`, or the natural inverse verb.
- Both functions must carry a JSDoc `Inverse:` cross-reference comment.

## Purity constraints

- No `import` from `node:fs`, `node:path`, or any I/O module.
- No network calls, no environment reads.
- No class state — all transforms are standalone functions.
- Calls to `Date.now()`, `Math.random()`, or similar non-deterministic sources are forbidden.

## Type constraints

- No `any` — use generics, discriminated unions, or `unknown` narrowed with type guards.
- Input and output types must be explicit named interfaces or type aliases — never inline objects in signatures.
- `import type` for type-only imports.

## Module constants

- Declare literals as `CONSTANT_CASE` module-level `const` when used more than once.
- Place constants above the function definitions in the same file.

## ESM imports

- `.js` extension on all relative imports.
- No barrel re-exports from `domain/formats/` — consumers import from the specific module.

## Agnostic shape example

```typescript
// domain/formats/widget-frontmatter.ts

const FRONTMATTER_DELIMITER = "---";

export interface WidgetFrontmatter {
  name: string;
  mode: "fast" | "safe";
  label?: string;
}

/**
 * Serializes a WidgetFrontmatter to a YAML frontmatter block.
 * Inverse: deserializeWidgetFrontmatter
 */
export function serializeWidgetFrontmatter(fm: WidgetFrontmatter): string {
  const lines: string[] = [FRONTMATTER_DELIMITER];
  lines.push(`name: ${fm.name}`);
  lines.push(`mode: ${fm.mode}`);
  if (fm.label !== undefined) lines.push(`label: ${fm.label}`);
  lines.push(FRONTMATTER_DELIMITER);
  return lines.join("\n");
}

/**
 * Parses a YAML frontmatter block into a WidgetFrontmatter.
 * Inverse: serializeWidgetFrontmatter
 */
export function deserializeWidgetFrontmatter(block: string): WidgetFrontmatter {
  // ... parse logic
}
```
