# Elements

| Topic | Rule |
| --- | --- |
| place | components and renders in `aidd_docs/ui/components/`. assets with their file in `aidd_docs/ui/assets/` |
| level | asset, atom, molecule, organism. an element uses its level or lower, never itself |
| `tokens` | the semantic tokens its own render uses, never a primitive. those of the elements it uses come with them |
| `states` | `default`. `hover`, `disabled`, `loading`, `error` when they exist |
| `focus` | only if the element itself takes focus. not if only an element it uses does |
| `## Keyboard` | present with `focus`, else none |
| `variants` | bare items, or `axis=value` for a prop varying on its own. never `state`, `variant` or `theme` as an axis |
| `platforms` | optional, a subset of `system.md`'s. absent means all |
| `code` | one link or a list. at most one link per platform |
| `code` link | `path[#Export]@<version>` or `[platform=]package:<name>[#Export]@<version>`. `platform=` when `system.md` lists several platforms. `#Export` when the techno has one. `<version>` is the one the code implements, at most `version`. A path link sits on its code root's platform. |
| no link | an assembled molecule or organism whose used elements are all coded. an element coded nowhere yet |
| render coverage | each variant value and each state at least once, on an element. no product of axes |
| render attributes | `data-variant`, `data-<axis>`, `data-state` |
| render theme, platform | `data-theme` and `data-platform` on `<html>` alone. the base needs none. another is another document, or a toggle of that attribute. never a wrapper |
| render style | `var()` of its tokens and of the elements it uses. no colour literal. no length literal but a hairline, as below. logical properties when a declared locale is right to left |
| element no render shows faithfully | rendered as close as tokens allow. the gap named to the user |
| molecule render | copies the markup and style of the elements it uses |
| length no token holds | up to 2px, a warning. larger, the nearest token, the gap named to the user |
