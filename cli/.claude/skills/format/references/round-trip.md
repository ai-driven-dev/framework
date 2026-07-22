# Reference: Round-Trip Requirement

## Lossless identity

A pair of functions `forward` and `reverse` is a lossless round-trip when:

```
reverse(forward(x)) === x   // for all valid inputs x
```

In practice, "===" means deep structural equality (same fields, same types, same values).
If the output type is a string, `===` is strict string equality.
If the output type is an object, every field must match after the round-trip.

## Verification pattern

Before marking 02 complete, trace the round-trip manually with one representative example:

```typescript
// Example: widget frontmatter
const input: WidgetFrontmatter = { name: "my-widget", mode: "fast", label: "My Widget" };
const serialized = serializeWidgetFrontmatter(input);
const restored = deserializeWidgetFrontmatter(serialized);
// Assert: restored.name === input.name, restored.mode === input.mode, restored.label === input.label
```

Choose an input that exercises all optional fields.

## Composition order for content rewrites

When forward and inverse are composed with base helpers (see `tool` skill):

- Forward: apply base transform first, then tool-specific transforms.
- Inverse: apply tool-specific reverse transforms first, then base reverse transform.

This ordering is mandatory: violating it breaks the lossless identity.

## When lossless is not achievable

Some transforms are intentionally lossy (hash functions, truncation, schema validation).
In these cases:
- Do NOT implement an inverse.
- Add `// Lossy: no inverse defined — <reason>` at the top of the function.
- Skip action 02 and document the skip.

## Unit test for round-trip identity

The test for the inverse (action 03) must include one `it()` block that asserts the full
round-trip identity:

```typescript
it("round-trips a complete WidgetFrontmatter without loss", () => {
  const input: WidgetFrontmatter = { name: "foo", mode: "safe", label: "Foo" };
  expect(deserializeWidgetFrontmatter(serializeWidgetFrontmatter(input))).toEqual(input);
});
```
