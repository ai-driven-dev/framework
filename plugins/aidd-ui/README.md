← [aidd-framework](../../README.md)

# aidd-ui

UI and UX design.

| | |
| --- | --- |
| Status | alpha |
| Install | `/plugin install aidd-ui@aidd-framework` |
| Start with | `/aidd-ui:01-system` |
| Skills, agents, hooks | [Catalog](../../docs/CATALOG.md#-aidd-ui) |

> [!WARNING]
> Not ready for use.
> Skills and names may change or disappear without notice.

## Design system

One file per element, under `aidd_docs/ui/`.

```txt
aidd_docs/ui/
├── system.md             the design system
├── brand.md              the brand
├── tokens.json           tokens of the base theme, DTCG 2025.10
├── tokens.resolver.json  the other themes, DTCG Resolver 2025.10
├── themes/<theme>.json   the tokens one theme redefines
├── tokens.css            generated from the tokens by the engine, never written by hand
├── assets/<id>.md        an icon, image or illustration, its file beside it
├── components/<id>.md    an atom, molecule or composition
├── components/<id>.html  its render: every variant and state
├── screens/<id>.md       a screen
├── screens/<id>.html     its render: every state
├── journeys/<id>.md      a user journey
└── reviews/<id>.md       the verdicts of a review
```

Every record opens with flat front matter, `key: value` or `key: [a, b]`, and closes with a `## History` table: Version, Change, Breaking (`yes` or `no`), Task. A task is its folder, `aidd_docs/tasks/…`.

| Record | Front matter | Body |
| --- | --- | --- |
| every one | `id` (the file name), `kind`, `status` (`proposed`, `validated`, `deprecated`), `version` | `## History` |
| `system.md` | `format` (`1`), `version` in semver, `platforms`, `breakpoints`, `themes`, `locales`, `directions`, `primitives` (token groups components never cite), `code-roots`, `ignore`, `libraries`, each `[]` when empty; optional `code-tokens`, one file | optional `## Rules`: Id, Rule |
| `brand.md` | | `## Project`, `## Users`, `## Domain`, `## Platforms`, `## Personality and tone`, `## References`, `## Anti-references`; optional `## Glossary`: Concept, Word, Forbidden |
| atom, molecule, composition | `uses`, `tokens`, `variants`, `states`, `interactive` (`yes` or `no`), `role`; optional `code`, `implemented-version` | `## Usage`, and `## Keyboard` when interactive |
| screen | `uses`, `tokens`, `states`, `breakpoints`, `route`; optional `code`, `implemented-version` | |
| journey | `persona` | `## Steps`: Screen, Action |
| asset | `type` (`icon`, `image`, `illustration`), `file`, `alt` | |
| review | `scope`, `screens` | `## Verdicts`: Screen, State, Version, Verdict (`ok`, `ko`, `pending`), Comment |

### Versions

- `status` tracks the design; `implemented-version` is the version the code implements. Code is current when it equals `version`, behind when lower.
- `code` is `path#Export`, or `package:<name>#Export` for a library component; an `.astro` file may be a bare path, an Astro component having no named export. It is required with `implemented-version`, except for a molecule or composition whose used elements are all implemented.
- `system.md` takes a history row only when a version is published; its Task cell lists the published tasks, comma-separated. A row that publishes a task which broke an element is breaking and raises the major; a token-only change says `yes` itself. Any other row raises the minor.
- A verdict counts for the version it names only.
- A `format` this validator does not read is reported alone.

### Links and tokens

- A link to a file in a folder of its own name covers that folder, styles, hooks and tests; among siblings it covers only the files of its name.
- An element uses elements of its own level or lower, never itself; an interactive component has `focus`, and `hover` or `disabled` only when they exist.
- A deprecated element names `replaced-by: <id>`, or `replaced-by: none` with a `## Deprecation` section.
- A render uses only the tokens its record lists in `tokens`, or those of the elements it uses, transitively. Its literals are read in `<style>` blocks and `style=""` values only, never in its text; a variant or state counts when an element outside `<style>` carries its `data-` attribute.
- `code-tokens` names the file where the code consumes the tokens; it is never checked for literals or coverage.
- Themes: the first theme in `system.md` is held by `tokens.json`. `tokens.resolver.json` has a set whose sources hold `{"$ref": "tokens.json"}`, a `theme` modifier with one context per theme and the base as `default`, and `{"$ref": "#/modifiers/theme"}` in `resolutionOrder`. A context lists `{"$ref": "<file>"}` sources, each redefining base tokens with their type.
- A value DTCG cannot hold, such as `color-mix()` or `100%`, is raw CSS: `"$extensions": {"dev.ai-driven.css": "<value>"}`. Each `var()` in it must name a token.
- `$root` is not supported: name the token. A token holding both `$value` and child tokens is an error: its children would be dropped.
- A token's CSS name is `--` plus its path joined by `-`.
- `tokens.css` is generated: a custom property per token, the base in `:root, [data-theme="<base theme>"]`, so a nested region can switch back to it, each other theme in `[data-theme="<theme>"]`, an alias as `var()`, raw CSS verbatim. A composite token (shadow, border, typography, ...) has no CSS of its own: it needs a raw CSS extension to appear in it.
- A component or screen render loads it with `<link rel="stylesheet" href="../tokens.css">`, so a token change reaches every render without rewriting one.
- A validated or deprecated element edited since its committed version, without a new `version`, is an error. A change to `status`, `implemented-version`, `code` or the History table is not an edit. A validated element is also held to the resolved value, in any theme, of each token it or an element it uses declares, compared with the committed `tokens.css`; a token change leaves a deprecated element as it is.

## Commands

```sh
node <plugin>/hooks/aidd-ui.cjs validate [project-root]
node <plugin>/hooks/aidd-ui.cjs tokens [project-root]
node <plugin>/hooks/aidd-ui.cjs impact <id or token>… [--root <dir>]
```

| Command | Does |
| --- | --- |
| `validate` | checks the whole design system |
| `tokens` | writes `aidd_docs/ui/tokens.css` and prints its path; writes nothing and exits 1 while a token has an error or a composite token has no raw CSS |
| `impact` | prints as JSON the `tokens`, `elements`, `screens`, `journeys`, `renders` and `code` files a change to those tokens or elements reaches, each sorted; a token is named by its path or its CSS name, and any token reached adds the `code-tokens` file to `code`; a name that is neither exits 2 |

## Validation

`validate` prints `VALID`, or one `✗ <file>: <message> (<rule>)` line per error and `⚠` per warning, and exits 1 when an error remains. Warnings: a file under a code root no record links, and a render length of 2px or less.

A hook runs the same check:

| Moment | Prints |
| --- | --- |
| Session start | the counts, then the errors |
| After a write under `aidd_docs/ui/` or a code root | the problems of the written files, their record's render and the records citing it, or all of them after a write to `system.md`, the tokens or a theme; then the count of other errors |
| End of a turn that wrote such a file | the errors, as a reason to continue, once |

Each output stops at 20 problem lines and names the command that prints the rest.

Rules: records R1 to R17, history H1 to H8, tokens T1 to T10, renders V1 to V8, code C1 to C8.

## Limits

- Without `node` on `PATH`, the hook does nothing.
- After a write, the problems reach the model in the same turn on Claude Code, Codex, Copilot CLI, OpenCode and Kilo. At turn end, OpenCode and Kilo receive the errors as the next prompt. A forced continuation is never asked again. The turn mark lives in the OS temp directory; without a session id, no end-of-turn check runs.
- Cursor is unverified.
- Codex runs the hook only once you trust it; Copilot only in a folder it trusts, and says nothing otherwise.
- A file written by a shell command, or deleted by a patch, is not seen.
- A problem a write causes in a record that does not cite the written one, such as a use of a renamed id, appears at turn end only.
- The Resolver is read in one profile: a `theme` modifier with file sources. Inline sources and other modifiers are not checked.
- Composite tokens are checked for a `$value`, not for its shape, and reach `tokens.css` only as raw CSS.
- `impact` leaves reviews out of its report.
- A web design system only: a native app, such as an Expo one, is outside it.
- The committed baseline of H8 is `HEAD`: without `git`, a repository or a commit, the rule is silent, and committing an edit without raising the version hides it. A run asks `git` once which files changed, then reads only those, plus the committed record of an element declaring a token whose value changed.
- A token value that depends on a breakpoint has no place yet.
- A component has one `variants` axis.
- A review validates screens only for now, so components are validated by hand until the review page exists.
- `code-roots` and `ignore` are path prefixes, not globs. Every folder under a code root is walked, `node_modules`, build output and dot-folders included: ignore them. A linked folder counts as one file no record links.
- A render shows a variant or state when it holds its `data-variant` or `data-state` attribute; an export exists when its name is a word of the linked file, a comment included.
- The hook command names `${CLAUDE_PLUGIN_ROOT}` unquoted, like every plugin here: a plugin path with spaces breaks it.
- In code, only colour literals are found, in web code only, outside tests and mocks, which C3 leaves out of the backlog too; other literals are left to the UI audit.
- In script files, `.vue` and `.svelte` included, colours are found in string literals only. A Vue or Svelte component needs an export name in its link. An `.astro` file is read the same way, plus its `<style>` blocks.
- A word of hex letters after `#` in a stylesheet or a string, such as `#add`, counts as a colour.
- Fixed widths on text and long translations are left to the UI audit.

## Try it from a checkout

| Scope | Run |
| --- | --- |
| This session only | `claude --plugin-dir plugins/aidd-ui` |
| Persistent | `/plugin marketplace add .`, then `/plugin install aidd-ui@aidd-framework` |
