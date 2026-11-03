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
| themes | the first theme is `tokens.json`; each other is a `theme` context of `tokens.resolver.json` listing `themes/<theme>.json` |
| breakpoints | the starting one is `tokens.json`; each other is a `breakpoint` context listing `breakpoints/<name>.json`, its query in `dev.ai-driven.media`, in `breakpoints` order, the winning query last |
| platforms | the first is `tokens.json`; each other with its own values is a `platform` context listing `platforms/<name>.json`; the modifier is optional |
| themes, platforms and breakpoints | one resolver holding their modifiers, each in `resolutionOrder`; a token several set takes the value of the later one |
| context file | redefines base tokens only, keeping their type; `$type` left out, as `extract` writes it |
| code | `code-tokens` names the file the code consumes them from, or one per app |
| `tokens.css` | written by `tokens` only, never by hand; tracked, since the version guard reads the committed one |

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
{"space": {"md": {"$value": {"value": 1.5, "unit": "rem"}}}}
```

Platforms `web` and `mobile`, one theme:

```json
{"version": "2025.10", "sets": {"base": {"sources": [{"$ref": "tokens.json"}]}}, "modifiers": {"platform": {"default": "web", "contexts": {"web": [], "mobile": [{"$ref": "platforms/mobile.json"}]}}}, "resolutionOrder": [{"$ref": "#/sets/base"}, {"$ref": "#/modifiers/platform"}]}
```
