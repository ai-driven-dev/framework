# Tokens

DTCG 2025.10 in `aidd_docs/ui/tokens.json`.

| Topic | Rule |
| --- | --- |
| levels | blank project: primitives, the palette and scales in the groups `primitives` lists, then semantic tokens aliasing them as `{group.name}`; extracted: the code's structure, no invented layer, `primitives: []` allowed |
| colour | `{"colorSpace": "srgb", "components": [r, g, b], "alpha": 0.5, "hex": "#rrggbb"}`, `alpha` optional |
| dimension, duration | `{"value": 1, "unit": "rem"}`, `{"value": 150, "unit": "ms"}` |
| value DTCG cannot hold, composite | `"$extensions": {"dev.ai-driven.css": "<css>"}`, its `var()`s naming tokens; a `$type` when a token aliases it |
| nesting | a token never holds a token: the hover of token `a.b` is `a.b-hover` |
| themes | the first theme is `tokens.json`; each other is a `theme` context of `tokens.resolver.json` listing `themes/<theme>.json` |
| breakpoints | the starting one is `tokens.json`; each other is a `breakpoint` context listing `breakpoints/<name>.json`, its query in `dev.ai-driven.media`, in `breakpoints` order, the winning query last |
| both | one resolver holding both modifiers, both in `resolutionOrder` |
| context file | redefines base tokens only, with their type |
| theme and breakpoint | a token a theme sets, directly or through what it cites, never changes with the width |
| code | `code-tokens` names the file the code consumes them from, or one per app |

Themes `light` and `dark`:

```json
{"version": "2025.10", "sets": {"base": {"sources": [{"$ref": "tokens.json"}]}}, "modifiers": {"theme": {"default": "light", "contexts": {"light": [], "dark": [{"$ref": "themes/dark.json"}]}}}, "resolutionOrder": [{"$ref": "#/sets/base"}, {"$ref": "#/modifiers/theme"}]}
```

Breakpoints `mobile` and `desktop`, one theme:

```json
{"version": "2025.10", "sets": {"base": {"sources": [{"$ref": "tokens.json"}]}}, "modifiers": {"breakpoint": {"default": "mobile", "contexts": {"mobile": [], "desktop": [{"$ref": "breakpoints/desktop.json"}]}, "$extensions": {"dev.ai-driven.media": {"desktop": "(min-width: 64rem)"}}}}, "resolutionOrder": [{"$ref": "#/sets/base"}, {"$ref": "#/modifiers/breakpoint"}]}
```

with `breakpoints/desktop.json`:

```json
{"space": {"md": {"$type": "dimension", "$value": {"value": 1.5, "unit": "rem"}}}}
```
