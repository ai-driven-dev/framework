# 05 - Components

Give the assets and components their records and renders.

## Input

The tokens, and the elements extract found or the person asked for.

## Process

1. **List.** Name the assets and the components wanted, each at its level: atom, molecule or composition.
2. **Assets.** For each, write its record from the [asset template](../assets/asset.md) and put its file beside it.
3. **Components.** For each, write its record from the [component template](../assets/component.md), and its render in the same turn: a record alone is an error until its render exists.
   - List only semantic tokens, never a primitive, in `tokens`.
   - Declare `focus` when it is interactive, and `hover` or `disabled` only when it has them.
4. **Render.** Write its HTML from the [render skeleton](../assets/render.html) beside the record.
   - Show every variant and state, each with `data-variant`, or `data-<axis>` for an `axis=value` item, and `data-state` on an element, never only in a style selector.
   - A molecule or composition shows the elements it uses, each with its own tokens, which its render may use too.
   - Style with `var()` of the tokens the record and the elements it uses list. The check forbids colour literals and lengths in `<style>` and `style=""`, and physical properties such as `margin-left` when `rtl` is declared; copy is not read.
5. **Check.** Fix what the hook reports on the record and its render, then do the next element.

## Output

A record and a render per component, a record and its file per asset, all `proposed`.

## Test

| Case | Pass |
| --- | --- |
| Component | its render loads `../tokens.css` and shows every declared variant and state |
| Primitive token in `tokens` | the hook reports it and the record is corrected |
| Render using a colour or a length | the hook reports it and the render is corrected |
| Extracted component | its record keeps its `code` link and `implemented-version` |
