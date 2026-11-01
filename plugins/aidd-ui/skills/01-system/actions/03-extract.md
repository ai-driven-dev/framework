# 03 - Extract

Read the design system out of the code that already exists.

## Input

The code roots from `system.md`, and the token source even outside them.

## Process

1. **Read.** Read the code roots: where colours, spacing, type and motion are defined, the components and their props, the icons and images.
2. **Tokens.** Write what the code defines as `aidd_docs/ui/tokens.json` in the format [tokens](04-tokens.md) describes, a token per defined value, nothing invented.
   - Only document-level custom properties become tokens. A property scoped to a component or written by a script stays in code, and is named to the person; so is a non-token declaration such as `color-scheme`.
   - A media query overriding a token's value is a breakpoint context of that format, never dropped: the value outside the query stays in `tokens.json`, the override goes in `breakpoints/<breakpoint>.json`, the query verbatim in the resolver.
   - Token files of other apps, and how far they drifted from this one, are reported to the person.
3. **Elements.** Write one record per asset and component. A component takes its `code` link and `implemented-version: 1`; an asset never does. A render comes with [components](05-components.md): V1 is expected until then.
   - Use the [component template](../assets/component.md) and the [asset template](../assets/asset.md), then add the code link lines the template's comment names. An `.astro` component links by its bare path, having no named export.
   - A CSS-only component has no `code` link and no `implemented-version` until it has a file of its own.
   - Props that vary on their own become axes: a `size` and a `tone` prop give `variants: [size=sm, size=md, tone=danger]`, never their combinations. A prop named `variant` gives bare items instead.
   - Level by what a component uses: an atom uses no component, a molecule uses atoms, a composition uses molecules.
4. **Cover.** Run `validate` and take each C3 warning as a file under a code root no record links yet.
   - Link it with a record, or add its path to `ignore` in `system.md`. Components not recorded yet are a backlog these warnings list, not a failure.
5. **Report.** Colour literals in committed files are existing debt, reported as warnings: list them for the person. This skill never writes in the code, the feature that touches the file removes the literal. Never `ignore` a hand-written file or narrow `code-roots` to silence one: both hide code from coverage.
   - A literal in generated output, such as a gitignored file under a code root, is no debt: that output goes in `ignore`.

## Output

`tokens.json` and the records of the assets and components found, `proposed`, the components with their code links.

## Test

| Case | Pass |
| --- | --- |
| Code with document-level custom properties | each one is a token, none is invented |
| A property scoped to a component, or `color-scheme` | it stays in code and is named to the person |
| A custom property overridden in a media query | the override is in a breakpoint file, `tokens.css` holds the same query |
| A linked component | its record carries `code` and `implemented-version: 1` |
| An asset or a CSS-only component | its record carries neither |
| A component with `size` and `tone` props | `variants` lists each value as `size=<value>` or `tone=<value>` |
| An unlinked file | the C3 warning is gone by a record or by `ignore`, or kept as backlog |
| A committed colour literal in the code | the code is untouched, the file is not in `ignore`, the warning is listed |
| A colour literal in a gitignored generated file | the file is in `ignore`, the error is gone |
