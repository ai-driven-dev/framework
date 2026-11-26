# Tokens

DTCG 2025.10 in `aidd_docs/ui/tokens.json`.

| Topic | Rule |
| --- | --- |
| file | `aidd_docs/ui/tokens.json`, and its context files |
| levels, blank project | primitives: the palette and scales, in the groups `primitives` lists. Then semantic tokens aliasing them as `{group.name}`. Semantic tokens sit in groups `primitives` omits: primitive `palette`, semantic `color`. |
| semantic set, blank project | colour: background, surface, text, text-muted, accent, text-on-accent, border, focus. Type: body and heading, each with family, size, line height, weight. Spacing: inset, gap. Corner: control, surface. Stroke: border-width, focus-ring-width. `control.min-height`, at least each platform's touch floor. Any other primitive type: one semantic token named by its role. |
| levels, extracted | the code's structure, no invented layer. `primitives: []` allowed |
| colour | `{"colorSpace": "srgb", "components": [r, g, b], "alpha": 0.5, "hex": "#rrggbb"}`. `alpha` optional |
| dimension, duration | `{"value": 1, "unit": "rem"}`, `{"value": 150, "unit": "ms"}` |
| unitless native value | a React Native or density-independent number is `px` |
| value DTCG cannot hold, composite | `"$extensions": {"dev.ai-driven.css": "<css>"}`. Its `var()`s name tokens. A `$type` when a token aliases it |
| nesting | a token never has child tokens, aliases aside. The hover of `a.b` is `a.b-hover` |
| base theme, platform, breakpoint | the first of each is `tokens.json` |
| other theme, platform, breakpoint | `themes/<theme>.json`, `platforms/<name>.json`, `breakpoints/<name>.json`, each with its own values |
| breakpoint order | table order, the winning query last |
| context file | redefines base tokens only, keeping their type. `$type` left out, as `extract` writes it |
