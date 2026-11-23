# Kit

The files a logo is made of. Each is one asset record beside its file in `aidd_docs/ui/assets/`.

## Files

| Id | `type` | File | What it is |
| --- | --- | --- | --- |
| `logo-mark` | `icon` | `logo-mark.svg` | the symbol alone |
| `logo-wordmark` | `image` | `logo-wordmark.svg` | the symbol with the project's name |
| `logo-favicon` | `icon` | `logo-favicon.svg` | the symbol simplified to read at 16px |

## SVG

| Topic | Rule |
| --- | --- |
| format | SVG only, with a `viewBox` and no fixed `width` or `height` |
| shapes | paths and basic shapes, no embedded raster |
| colours | the values of `aidd_docs/ui/tokens.json` when it exists, else those the brand facts name, else asked |
| light and dark | one file, its dark colours under `@media (prefers-color-scheme: dark)` inside the SVG |
| `alt` | the project's name, and what the file shows when it is not the full logo |

## Limits

| Limit | Why |
| --- | --- |
| the wordmark's name renders in the font installed where it is shown | SVG `<text>` is not outlined |
| email clients and raster exports show the light colours only | they ignore the media query |
