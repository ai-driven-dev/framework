# Tokens

DTCG 2025.10 in `aidd_docs/ui/tokens.json`.

| Topic | Rule |
| --- | --- |
| levels | blank project: primitives, the palette and scales in the groups `primitives` lists, then semantic tokens aliasing them as `{group.name}`; extracted: the code's structure, no invented layer, `primitives: []` allowed |
| colour | `{"colorSpace": "srgb", "components": [r, g, b], "alpha": 0.5, "hex": "#rrggbb"}`, `alpha` optional |
| dimension, duration | `{"value": 1, "unit": "rem"}`, `{"value": 150, "unit": "ms"}` |
| unitless native value | a React Native or density-independent number is `px` |
| value DTCG cannot hold, composite | `"$extensions": {"dev.ai-driven.css": "<css>"}`, its `var()`s naming tokens; a `$type` when a token aliases it |
| nesting | a token never has child tokens, aliases aside: the hover of token `a.b` is `a.b-hover` |
| themes, platforms, breakpoints | the first of each is `tokens.json`; each other with its own values is `themes/<theme>.json`, `platforms/<name>.json` or `breakpoints/<name>.json`, a breakpoint's media query being the `Query` of its `## Breakpoints` row in `system.md`, in the order of the table, the winning query last |
| context file | redefines base tokens only, keeping their type; `$type` left out, as `extract` writes it |
| `tokens.resolver.json` | written by `tokens` and `extract` from `system.md` and those files, never by hand; a token several modifiers set takes the value of the later one |
| code | `code-tokens` names the file the code consumes them from, or one per app |
| `tokens.css` | written by `tokens` only, never by hand; tracked, since the version guard reads the committed one |
