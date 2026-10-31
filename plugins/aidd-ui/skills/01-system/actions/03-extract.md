# 03 - Extract

Read the design system out of the code that already exists.

## Input

The code roots from `system.md`.

## Process

1. **Read.** Read the code roots: where colours, spacing, type and motion are defined, the components and their props, the icons and images.
2. **Tokens.** Write what the code defines as `aidd_docs/ui/tokens.json` in the format [tokens](04-tokens.md) describes, a token per defined value, nothing invented.
   - A media query overriding a token's value is a breakpoint context of that format, never dropped: the value outside the query stays in `tokens.json`, the override goes in `breakpoints/<breakpoint>.json`, the query verbatim in the resolver.
3. **Elements.** Write one record per asset and component, each with its `code` link and `implemented-version: 1`.
   - Use the [component template](../assets/component.md) and the [asset template](../assets/asset.md), then add the code link lines the template's comment names. An `.astro` component links by its bare path, having no named export.
   - Props that vary on their own become axes: a `size` and a `tone` prop give `variants: [size=sm, size=md, tone=danger]`, never their combinations.
   - Level by what a component uses: an atom uses no component, a molecule uses atoms, a composition uses molecules.
4. **Cover.** Run `validate` and take each C3 warning as a file under a code root no record links yet.
   - Link it with a record, or add its path to `ignore` in `system.md`. Components not recorded yet are a backlog these warnings list, not a failure.
5. **Report.** List each colour literal the validator reports in the code and leave the error for the person: this skill never writes in the code, the feature that touches the file removes the literal. Never `ignore` a file to silence a literal, it hides the file from coverage too; narrow `code-roots` instead.

## Output

`tokens.json` and the records of the assets and components found, `proposed`, with their code links.

## Test

| Case | Pass |
| --- | --- |
| Code with custom properties | each one is a token, none is invented |
| A custom property overridden in a media query | the override is in a breakpoint file, `tokens.css` holds the same query |
| A linked component | its record carries `code` and `implemented-version: 1` |
| A component with `size` and `tone` props | `variants` lists each value as `size=<value>` or `tone=<value>` |
| An unlinked file | the C3 warning is gone by a record or by `ignore`, or kept as backlog |
| A colour literal in the code | the code is untouched, the file is not in `ignore`, the error is left and listed |
