# 02 - Round Trip

Implement the inverse function and verify that `reverse(forward(x)) === x` holds for all
valid inputs.

## Inputs

- `forward-function` (required) - string, name of the function from 01 (e.g. `serializeWidgetFrontmatter`)
- `inverse-name` (required) - string, name for the inverse function (e.g. `deserializeWidgetFrontmatter`)

## Outputs

```typescript
/**
 * Parses a YAML frontmatter block back into a WidgetFrontmatter object.
 * Inverse: serializeWidgetFrontmatter
 */
export function deserializeWidgetFrontmatter(block: string): WidgetFrontmatter {
  const lines = block
    .split("\n")
    .filter((l) => l !== FRONTMATTER_DELIMITER && l.trim().length > 0);
  const entries = Object.fromEntries(lines.map((l) => l.split(": ", 2) as [string, string]));
  if (!entries.name || !entries.mode) {
    throw new Error("Missing required frontmatter fields: name, mode");
  }
  return { name: entries.name, mode: entries.mode, version: entries.version };
}
```

## Depends on

- `01-define-pure-function`

## Process

1. Open the same `domain/formats/<file>.ts` file as in 01.
2. Write the inverse function immediately below the forward function. Name it `reverse<ForwardName>` or `deserialize<Concept>` as appropriate.
3. Add a JSDoc comment that names the forward function (`Inverse: <forward-function-name>`).
4. Verify the lossless identity by tracing the round-trip manually with one representative example:
   - Choose a valid input value.
   - Apply the forward function to get the intermediate form.
   - Apply the inverse to get back the original.
   - Confirm the final value equals the original — same fields, same types.
5. If the forward transform is lossy by design (e.g. a hash, a truncation), do not write an inverse. Instead add a comment `// Lossy: no inverse defined` and skip this action. Document the skip in your implementation notes.

## Test

Run `pnpm typecheck` — exits 0 confirms the inverse function compiles and shares types correctly with the forward function.
