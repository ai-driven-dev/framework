# 05 - Components

Give the assets and components their records and renders.

## Input

The tokens, and the elements extract found or the person asked for.

## Process

1. **List.** Name the assets and the components wanted, each at its level: atom, molecule or composition.
2. **Assets.** For each, write its record from the [asset template](../assets/asset.md) and put its file beside it.
3. **Components.** For each, write its record from the [component template](../assets/component.md).
   - List only semantic tokens, never a primitive, in `tokens`.
   - Declare `focus` when it is interactive, and `hover` or `disabled` only when it has them.
4. **Render.** Write its HTML from the [render skeleton](../assets/render.html) beside the record.
   - Show every variant and state, each with `data-variant` and `data-state`.
   - Style with `var()` of the tokens the record lists and no other, never a value.
5. **Check.** Fix what the hook reports on the record and its render, then do the next element.

## Output

A record and a render per component, a record and its file per asset, all `proposed`.

## Test

| Case | Pass |
| --- | --- |
| Component | its render loads `../tokens.css` and shows every declared variant and state |
| Primitive token in `tokens` | the hook reports it and the record is corrected |
| Render using a value | the hook reports it and the render is corrected |
| Extracted component | its record keeps its `code` link and `implemented-version` |
