# Elements

| Topic | Rule |
| --- | --- |
| place | components and renders in `aidd_docs/ui/components/`. Assets with their file in `aidd_docs/ui/assets/` |
| level | asset, atom, molecule, organism. An element uses its level or lower, never itself |
| `tokens` | the semantic tokens its own render uses, never a primitive. Those of the elements it uses come with them |
| `states` | `default`. `hover`, `disabled`, `loading`, `error` when they exist. `focus` only if the element itself takes focus |
| `## Keyboard` | present with `focus`, else none |
| `variants` | bare items, or `axis=value` for a prop varying on its own. Never `state`, `variant` or `theme` as an axis |
| `platforms` | optional, a subset of `system.md`'s. Absent means all |
| `code` | one link or a list. At most one link per platform |
| `code` link | `path[#Export]@<version>` or `[platform=]package:<name>[#Export]@<version>`. `platform=` when `system.md` lists several platforms. `#Export` when the techno has one. `<version>` is the one the code implements, at most `version`. |
| no link | an assembled molecule or organism whose used elements are all coded. An element coded nowhere yet |
| render coverage | each variant value and each state at least once, on an element. No product of axes |
| render attributes | `data-variant`, `data-<axis>`, `data-state` |
| render theme, platform | `data-theme` and `data-platform` on `<html>` alone. The base needs none. Another is another document, or a toggle of that attribute. Never a wrapper |
| render style | `var()` of its tokens and of the elements it uses. No colour literal. No length literal but a hairline, as below. Logical properties when a declared locale is right to left |
| element no render shows faithfully | rendered as close as tokens allow. The gap named to the user |
| molecule render | copies the markup and style of the elements it uses |
| length no token holds | up to 2px, a warning. Larger, the nearest token, the gap named to the user |
