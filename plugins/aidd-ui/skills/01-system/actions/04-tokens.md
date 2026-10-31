# 04 - Tokens

Define the tokens and generate the stylesheet every render loads.

## Input

The brand and `system.md`, and the tokens extract found when the code already had some.

## Process

1. **Define.** Write `aidd_docs/ui/tokens.json` in two levels: primitives, the palette and scales, in the groups `system.md` lists as `primitives`, then semantic tokens that alias them as `{group.name}`.
   - A colour is `{"colorSpace": "srgb", "components": [r, g, b], "hex": "#rrggbb"}`, a dimension `{"value": 1, "unit": "rem"}`, a duration `{"value": 150, "unit": "ms"}`.
   - A value the format cannot hold, such as `color-mix()` or `100%`, goes in `"$extensions": {"dev.ai-driven.css": "<css>"}`, its `var()`s naming existing tokens.
   - A composite token, such as a shadow or a border, carries its CSS the same way; without it the stylesheet cannot be generated.
2. **Themes.** The first theme in `system.md` is the base held by `tokens.json`; every other theme is a context of `aidd_docs/ui/tokens.resolver.json`.
   - The resolver has `"version": "2025.10"`, a set holding `{"$ref": "tokens.json"}`, a `theme` modifier with one context per theme and the base as `default`, and `{"$ref": "#/modifiers/theme"}` in `resolutionOrder`.
   - A context lists `{"$ref": "themes/<theme>.json"}`; that file redefines base tokens only, with their type.
3. **Generate.** Run `tokens`, which writes `aidd_docs/ui/tokens.css`; when it exits 1, fix the tokens it names and run it again.
4. **Link.** When the code consumes the tokens through a file, set `code-tokens` in `system.md` to it.

## Output

`tokens.json`, `tokens.resolver.json` and `themes/` when there is more than one theme, and the generated `tokens.css`.

## Test

| Case | Pass |
| --- | --- |
| Valid tokens | `tokens` exits 0 and prints the stylesheet path |
| Alias | the stylesheet holds `var(--group-name)` for it |
| Second theme | the stylesheet holds a `[data-theme]` block for it |
| Composite without raw CSS | `tokens` exits 1, names the token and writes nothing |
| Token changed after generating | the hook names the stylesheet as out of date until `tokens` runs |
