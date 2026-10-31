# 03 - Extract

Read the design system out of the code that already exists.

## Input

The code roots from `system.md`.

## Process

1. **Read.** Read the code roots: where colours, spacing, type and motion are defined, the components and their props, the icons and images.
2. **Tokens.** Write what the code defines as `aidd_docs/ui/tokens.json` in the format [tokens](04-tokens.md) describes, a token per defined value, nothing invented.
3. **Elements.** Write one record per asset and component, each with its `code` link and `implemented-version: 1`.
   - Use the [component template](../assets/component.md) and the [asset template](../assets/asset.md), then add the code link lines the template's comment names.
   - Level by what a component uses: an atom uses no component, a molecule uses atoms, a composition uses molecules.
4. **Cover.** Run `validate` and take each C3 warning as a file under a code root no record links yet.
   - Link it with a record, or add its path to `ignore` in `system.md`.
5. **Report.** List each colour literal the validator reports in the code and add its file to `ignore`: this skill never writes in the code, the feature that touches the file removes the literal.

## Output

`tokens.json` and the records of the assets and components found, `proposed`, with their code links.

## Test

| Case | Pass |
| --- | --- |
| Code with custom properties | each one is a token, none is invented |
| A linked component | its record carries `code` and `implemented-version: 1` |
| An unlinked file | the C3 warning is gone, by a record or by `ignore` |
| A colour literal in the code | the code is untouched and its file is in `ignore` |
