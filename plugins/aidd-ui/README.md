← [aidd-framework](../../README.md)

# aidd-ui

UI and UX design.

| | |
| --- | --- |
| Status | alpha |
| Install | `/plugin install aidd-ui@aidd-framework` |
| Start with | `/aidd-ui:01-hello` |
| Skills, agents, hooks | [Catalog](../../docs/CATALOG.md#-aidd-ui) |

> [!WARNING]
> Not ready for use.
> Skills and names may change or disappear without notice.

## Design system

One file per element, under `aidd_docs/ui/`.

```txt
aidd_docs/ui/
├── system.md            the design system
├── brand.md             the brand
├── tokens.json          tokens, DTCG 2025.10
├── assets/<id>.md       an icon, image or illustration, its file beside it
├── components/<id>.md   an atom, molecule or composition
├── components/<id>.html its render: every variant and state
├── screens/<id>.md      a screen
├── screens/<id>.html    its render: every state
├── journeys/<id>.md     a user journey
└── reviews/<id>.md      the verdicts of a review
```

Every record opens with flat front matter, `key: value` or `key: [a, b]`, and closes with a `## History` table: Version, Change, Breaking (`yes` or `no`), Task.

| Record | Front matter | Body |
| --- | --- | --- |
| every one | `id` (the file name), `kind`, `status` (`proposed`, `validated`, `coded`, `deprecated`), `version` | `## History` |
| `system.md` | `version` in semver, `platforms`, `breakpoints`, `themes`, `locales`, `directions`, `primitives` (token groups components never cite), `code-roots`, `ignore`, `libraries` | optional `## Rules`: Id, Rule |
| `brand.md` | | `## Project`, `## Users`, `## Domain`, `## Platforms`, `## Personality and tone`, `## References`, `## Anti-references`; optional `## Glossary`: Concept, Word, Forbidden |
| atom, molecule, composition | `uses`, `tokens`, `variants`, `states`, `interactive` (`yes` or `no`), `role`, `code` | `## Usage`, and `## Keyboard` when interactive |
| screen | `uses`, `states`, `breakpoints`, `route`, `code` | |
| journey | `persona` | `## Steps`: Screen, Action |
| asset | `type` (`icon`, `image`, `illustration`), `file`, `alt` | |
| review | `scope`, `screens` | `## Verdicts`: Screen, State, Verdict (`ok`, `ko`, `pending`), Comment |

- `code` is `path#Export`, or `package:<name>#Export` for a library component; required once `coded`, except for a molecule or composition whose used components are all coded.
- A link to a file in a folder of its own name covers that folder, styles, hooks and tests; among siblings it covers only the files of its name.
- An element uses elements of its own level or lower, never itself; an interactive component has `focus`, and `hover` or `disabled` only when they exist.
- A deprecated element names `replaced-by: <id>`, or `replaced-by: none` with a `## Deprecation` section.
- A theme value is a token extension: `"$extensions": {"dev.ai-driven.themes": {"dark": <value>}}`. The first theme in `system.md` is the base, held by `$value`; a themed token gives every other one.
- A value DTCG cannot hold, such as `color-mix()` or `100%`, is raw CSS: `"$extensions": {"dev.ai-driven.css": "<value>"}`, checked for presence only.
- `$root` is not supported: name the token.
- A token's CSS name is `--` plus its path joined by `-`.

## Validation

A hook checks the design system after every write under `aidd_docs/ui/` or a code root, and at session start. By hand:

```sh
node <plugin>/hooks/validate-ui.cjs [project-root]
```

It prints `VALID`, or one `✗ <file>: <message>` line per problem and exits 1.

## Limits

- Without `node` on `PATH`, the hook does nothing.
- A problem comes back in the same turn on Claude Code, Codex and Copilot CLI. On OpenCode and Kilo it does not; Cursor is unverified.
- Codex runs the hook only once you trust it; Copilot only in a folder it trusts, and says nothing otherwise.
- A file written by a shell command, or deleted by a patch, is not seen.
- Composite tokens are checked for a `$value`, not for its shape.
- Alias cycles are not detected.
- `code-roots` and `ignore` are path prefixes, not globs.
- In code, only colour literals are found, in web code only; other literals are left to the UI audit.
- In script files, `.vue` and `.svelte` included, colours are found in string literals only.
- A word of hex letters after `#` in a stylesheet or a string, such as `#add`, counts as a colour.
- Fixed widths on text and long translations are left to the UI audit.

## Try it from a checkout

| Scope | Run |
| --- | --- |
| This session only | `claude --plugin-dir plugins/aidd-ui` |
| Persistent | `/plugin marketplace add .`, then `/plugin install aidd-ui@aidd-framework` |
