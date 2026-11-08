---
status: implemented
---

# Instruction: Generate tokens.css

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-ui/hooks/
│   ├── aidd-ui.cjs                      ✏️ `tokens` command
│   └── lib/
│       ├── css.cjs                      ✅ token tree to CSS text
│       ├── tokens.cjs                   ✏️ T10 stale tokens.css, exports for css.cjs
│       └── renders.cjs                  ✏️ V8 render loads ../tokens.css
└── scripts/__tests__/
    ├── aidd-ui-css.test.js              ✅
    ├── aidd-ui-tokens-renders.test.js   ✏️ T10, V8
    ├── aidd-ui-validate.test.js         ✏️ `tokens` command
    └── fixtures/aidd-ui/project.js      ✏️ renders link the stylesheet, tokens.css generated
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | write the fixture project with base tokens, a dark theme and a raw CSS token | the project validates | system |
| Happy path   | run `aidd-ui.cjs tokens` | `aidd_docs/ui/tokens.css` holds `:root` with every base token and `[data-theme="dark"]` with the dark overrides, aliases as `var()`; a second run writes the same bytes; validate prints VALID | cli |
| Edge case    | tokens.json changes after generation | validate names `tokens.css` as out of date (T10) | cli |
| Edge case    | a render drops its `../tokens.css` link | validate names that render (V8) | cli |
| Edge case    | a composite token without raw CSS, or tokens with errors | `tokens` writes nothing, names the token or says to fix the tokens first, exits 1 | cli |

## Tasks to do

### `1)` Token tree to CSS

> One deterministic text from the base tree and each theme file.

1. `css.cjs` turns each token value into CSS: alias `{a.b}` to `var(--a-b)`; raw CSS extension verbatim; color to its hex when present without alpha below 1, else `color(<space> …)` or the space's own function, `none` kept, ` / alpha` when below 1; dimension and duration `value` plus `unit`; number and fontWeight as is; fontFamily a list joined with `, `, names holding a space quoted; cubicBezier `cubic-bezier(a, b, c, d)`.
2. A composite token without raw CSS is a problem naming it.
3. Output: a generated-file header comment, `:root {}` with base tokens in tree order, then one `[data-theme="<theme>"] {}` block per non-base theme in `system.md` order, from the Resolver's context files.

### `2)` The `tokens` command

> The skill regenerates the stylesheet with one call.

1. `aidd-ui.cjs tokens [root]` refuses when any T rule reports an error, printing those, exit 1.
2. Otherwise writes `aidd_docs/ui/tokens.css`, prints its path, exit 0. Without a design system, prints nothing, exit 0.

### `3)` Stale stylesheet and unlinked render

> The hook says when a token write needs regenerating, and every render shows the real tokens.

1. T10: `tokens.css` absent or different from the generation, when the tokens have no error.
2. V8: a component or screen render without `<link rel="stylesheet" href="../tokens.css">`.
3. Fixture: renders carry the link, `tokens.css` is written from the generator.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | each value kind has a test asserting its exact CSS text; a composite without raw CSS is named |
| 2 | two runs produce identical bytes; tokens with an error leave no file and exit 1 |
| 3 | changing one token value turns T10 red; removing the link turns V8 red; the fixture stays VALID; each rule's mutation turns its own test red |
