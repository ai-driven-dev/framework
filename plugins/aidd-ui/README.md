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
| `system.md` | `version` in semver, `platforms`, `breakpoints`, `themes`, `locales`, `directions`, `code-roots`, `ignore`, `libraries` | |
| `brand.md` | | `## Project`, `## Users`, `## Domain`, `## Platforms`, `## Personality and tone`, `## References`, `## Anti-references` |
| atom, molecule, composition | `uses`, `tokens`, `variants`, `states`, `interactive` (`yes` or `no`), `role`, `code` | `## Keyboard` when interactive |
| screen | `uses`, `states`, `breakpoints`, `route`, `code` | |
| journey | `persona` | `## Steps`: Screen, Action |
| asset | `type` (`icon`, `image`, `illustration`), `file`, `alt` | |
| review | `scope`, `screens` | `## Verdicts`: Screen, State, Verdict (`ok`, `ko`, `pending`), Comment |

- `code` is `path#Export`, or `package:<name>#Export` for a library component; required once `coded`.
- A deprecated element names `replaced-by: <id>`, or `replaced-by: none` with a `## Deprecation` section.
- A theme value is a token extension: `"$extensions": {"dev.ai-driven.themes": {"dark": <value>}}`.
- A token's CSS name is `--` plus its path joined by `-`.

## Validation

A hook checks the design system after every write under `aidd_docs/ui/` or a code root, and at session start. By hand:

```sh
node <plugin>/hooks/validate-ui.cjs [project-root]
```

It prints `VALID`, or one `✗ <file>: <message>` line per problem and exits 1.

## Limits

- Without `node` on `PATH`, the hook does nothing.
- Outside Claude Code, a problem does not come back in the same turn.
- Codex runs the hook only once you trust it.
- The write matcher uses Claude Code's tool names; other hosts are unverified.
- Composite tokens are checked for a `$value`, not for its shape.
- Alias cycles are not detected.
- `code-roots` and `ignore` are path prefixes, not globs.
- Literals are found in web code only, and units in stylesheets only, not in script files.
- A word of hex letters after `#`, such as `#add`, counts as a colour.
- Fixed widths on text and long translations are left to the UI audit.

## Try it from a checkout

| Scope | Run |
| --- | --- |
| This session only | `claude --plugin-dir plugins/aidd-ui` |
| Persistent | `/plugin marketplace add .`, then `/plugin install aidd-ui@aidd-framework` |
