# 04 - Tokens

Define the tokens and generate the stylesheet every render loads.

## Input

The brand and `system.md`, and the tokens extract found when the code already had some.

## Process

1. **Define.** Write `aidd_docs/ui/tokens.json`. A blank project takes two levels: primitives, the palette and scales, in the groups `system.md` lists as `primitives`, then semantic tokens that alias them as `{group.name}`.
   - A token never contains a token: a hover variant of `a.b` is the leaf `a.b-hover` when `a.b` is a token.
   - A colour is `{"colorSpace": "srgb", "components": [r, g, b], "alpha": 0.5, "hex": "#rrggbb"}`, `alpha` optional, a dimension `{"value": 1, "unit": "rem"}`, a duration `{"value": 150, "unit": "ms"}`.
   - A value the format cannot hold, such as `color-mix()` or `100%`, goes in `"$extensions": {"dev.ai-driven.css": "<css>"}`, its `var()`s naming existing tokens.
   - A composite token, such as a shadow or a border, carries its CSS the same way; without it the stylesheet cannot be generated. Give a raw CSS token its `$type` when another token aliases it.
   - Primitives are the groups components never read; `primitives: []` is allowed when the code has no palette. Extracted tokens keep the code's own structure: invent no primitive layer.
2. **Themes.** The first theme in `system.md` is the base held by `tokens.json`; every other theme is a context of `aidd_docs/ui/tokens.resolver.json`.
   - The resolver has `"version": "2025.10"`, a set holding `{"$ref": "tokens.json"}`, a `theme` modifier with one context per theme and the base as `default`, its context empty, and `{"$ref": "#/modifiers/theme"}` in `resolutionOrder`.
   - A context lists `{"$ref": "themes/<theme>.json"}`; that file redefines base tokens only, with their type.
   - For themes `light` and `dark`: `{"version": "2025.10", "sets": {"base": {"sources": [{"$ref": "tokens.json"}]}}, "modifiers": {"theme": {"default": "light", "contexts": {"light": [], "dark": [{"$ref": "themes/dark.json"}]}}}, "resolutionOrder": [{"$ref": "#/sets/base"}, {"$ref": "#/modifiers/theme"}]}`.
3. **Breakpoints.** When a value depends on the width, `tokens.json` keeps the value of the breakpoint the styles start from, and each other value is a context of a `breakpoint` modifier in the same resolver, which a project with one theme then needs too.
   - The starting breakpoint is the modifier's `default`, its context empty. Another context lists `{"$ref": "breakpoints/<breakpoint>.json"}`; that file redefines base tokens only, with their type.
   - Its media query goes verbatim in the modifier's `dev.ai-driven.media` extension, under the context's name, `min-width` or `max-width`. The contexts other than the default follow the order of `breakpoints`: the query that must win comes last.
   - A token a theme sets, directly or through what it cites, cannot also change with the width: split it, or the validator names it.
   - For breakpoints `mobile` and `desktop` with one theme: `{"version": "2025.10", "sets": {"base": {"sources": [{"$ref": "tokens.json"}]}}, "modifiers": {"breakpoint": {"default": "mobile", "contexts": {"mobile": [], "desktop": [{"$ref": "breakpoints/desktop.json"}]}, "$extensions": {"dev.ai-driven.media": {"desktop": "(min-width: 64rem)"}}}}, "resolutionOrder": [{"$ref": "#/sets/base"}, {"$ref": "#/modifiers/breakpoint"}]}`, and `breakpoints/desktop.json` holds `{"space": {"md": {"$type": "dimension", "$value": {"value": 1.5, "unit": "rem"}}}}`.
4. **Generate.** Run `tokens`, which writes `aidd_docs/ui/tokens.css`; when it exits 1, fix the tokens it names and run it again.
5. **Link.** When the code consumes the tokens through a file, set `code-tokens` in `system.md` to it, or to a list when each app holds its own.

## Output

`tokens.json`, `tokens.resolver.json` with `themes/` when there is more than one theme, with `breakpoints/` when a value depends on the width, and the generated `tokens.css`.

## Test

| Case | Pass |
| --- | --- |
| Valid tokens | `tokens` exits 0 and prints the stylesheet path |
| Alias | the stylesheet holds `var(--group-name)` for it |
| Second theme | the stylesheet holds a `[data-theme]` block for it |
| Value depending on the width | the stylesheet ends with an `@media` block holding it |
| Composite without raw CSS | `tokens` exits 1, names the token and writes nothing |
| Token changed after generating | the hook names the stylesheet as out of date until `tokens` runs |
