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
├── system.md                the design system
├── brand.md                 the brand
├── tokens.json              tokens of the base theme and platform, DTCG 2025.10
├── tokens.resolver.json     generated from system.md and the files below by the engine, DTCG Resolver 2025.10
├── themes/<theme>.json      the tokens one theme redefines
├── platforms/<name>.json    the tokens one platform redefines
├── breakpoints/<name>.json  the tokens one breakpoint redefines
├── tokens.css               generated from the tokens by the engine, never written by hand
├── assets/<id>.md           an icon, image or illustration, its file beside it
├── components/<id>.md       an atom, molecule or composition
├── components/<id>.html     its render: every variant and state
├── screens/<id>.md          a screen
├── screens/<id>.html        its render: every state
├── journeys/<id>.md         a user journey
└── reviews/<id>.md          the verdicts of a review
```

Every record opens with flat front matter, `key: value` or `key: [a, b]`, and closes with a `## History` table: Version, Change, Breaking (`yes` or `no`), Task. A task is its folder, `aidd_docs/tasks/…`.

| Record | Front matter | Body |
| --- | --- | --- |
| every one | `id` (the file name), `kind`, `status` (`proposed`, `validated`, `deprecated`), `version` | `## History` |
| `system.md` | `format` (`1`), `version` in semver, `platforms`, `breakpoints`, `themes`, `locales`, `directions`, `primitives` (token groups components never cite, nested such as `color.brand` too), `code-roots` (`platform=path`, or a bare path when one platform is declared), `ignore`, `libraries`, each `[]` when empty; optional `code-tokens`, one file or a list, each `platform=path` like `code-roots` | `## Breakpoints`: Name, Query (a media query such as `(min-width: 64rem)`, none for the first), one row per breakpoint; optional `## Rules`: Id, Rule |
| `brand.md` | | `## Project`, `## Users`, `## Domain`, `## Platforms`, `## Personality and tone`, `## References`, `## Anti-references`; optional `## Glossary`: Concept, Word, Forbidden |
| atom, molecule, composition | `uses`, `tokens`, `variants` (a bare value, or `axis=value` per independent prop), `states`, `interactive` (`yes` or `no`), `role`; optional `code`, `platforms` | `## Usage`, and `## Keyboard` when interactive |
| screen | `uses`, `tokens`, `states`, `breakpoints`, `route`; optional `code`, `platforms` | |
| journey | `persona` | `## Steps`: Screen, Action |
| asset | `type` (`icon`, `image`, `illustration`), `file`, `alt` | |
| review | `scope`, `screens` | `## Verdicts`: Screen, State, Version, Verdict (`ok`, `ko`, `pending`), Comment |

### Versions

- `status` tracks the design; each `code` link carries the version the code implements. A platform is current when it equals `version`, behind when lower; an element with no link is coded nowhere.
- `platforms` is one platform or a list, a subset of `system.md`'s; absent means all.
- `code` is one link or a list, each `path[#Export]@<version>`, or `package:<name>[#Export]@<version>` for a library component. `#Export` is optional, whatever the techno; `@<version>` is an integer from 1, at most the record's `version`. A path link's platform is the one of the code root holding it, the innermost when roots nest; with several platforms declared, a package link names its own, `platform=package:<name>#Export@<version>`. A link's platform is one of the record's, and no platform has two links. A molecule or composition whose used elements are all coded needs no link.
- `system.md` takes a history row only when a version is published; its Task cell lists the published tasks, comma-separated. A row that publishes a task which broke an element is breaking and raises the major; a token-only change says `yes` itself. Any other row raises the minor.
- A verdict counts for the version it names only.
- A `format` this validator does not read is reported alone.

### Links and tokens

- A link to a file in a folder of its own name covers that folder, styles, hooks and tests; among siblings it covers only the files of its name.
- An element uses elements of its own level or lower, never itself; an interactive component has `focus`, and `hover` or `disabled` only when they exist.
- A deprecated element names `replaced-by: <id>`, or `replaced-by: none` with a `## Deprecation` section.
- A render uses only the tokens its record lists in `tokens`, or those of the elements it uses, transitively. Its literals are read in `<style>` blocks and `style=""` values, never in its text, and its colours also in `fill`, `stroke`, `color` and `bgcolor` values, where a value opening with `var()` is a token; a variant or state counts when an element outside `<style>` carries its `data-` attribute: `data-variant="<value>"` for a bare item, `data-<axis>="<value>"` for `axis=value`, `data-state="<value>"` for a state.
- An axis matches `[a-z][a-z-]*`, is never `state`, `variant` or `theme`, and its value is never empty.
- Each `code-roots` item belongs to a platform: `platform=path`, required once `system.md` declares several, whose names it must list; a bare path belongs to the only one declared.
- `code-tokens` names the file where the code consumes the tokens, or a list, one per app; each is never checked for literals or coverage. An item is `platform=path` like a `code-roots` item, so a file outside every code root has its platform; a bare one belongs to the only platform declared, else to the platform of the root holding it.
- Themes, platforms, breakpoints: the first of each in `system.md` is held by `tokens.json`; each other with values of its own is a context file, `themes/<t>.json`, `platforms/<p>.json`, `breakpoints/<b>.json`, redefining base tokens with their type. A breakpoint's media query is the `Query` of its `## Breakpoints` row, and the breakpoints follow the order of `breakpoints` in `system.md`, which the `@media` blocks take. `tokens.resolver.json` is written by the engine from these, `tokens` and `extract` alike, and T6 still checks one written by hand or left stale: a Resolver in this plugin's one profile, a `theme` modifier from two themes on, `platform` and `breakpoint` modifiers once a context other than the first has a file, each in `resolutionOrder` and listing its files as `{"$ref": "<file>"}`.
- A token several modifiers redefine takes the value of the one later in `resolutionOrder`, and a theme, a platform and a breakpoint may redefine the same one. A token depending on tokens of two of them recomputes through its `var()`s.
- A value DTCG cannot hold, such as `color-mix()` or `100%`, is raw CSS: `"$extensions": {"dev.ai-driven.css": "<value>"}`. Each `var()` in it must name a token. No value may lead back to its own token, through an alias or a `var()`, across the base and the context it sits in: the browser would compute nothing. A theme or breakpoint file may redefine a token this way too.
- `$root` is not supported: name the token. A token holding both `$value` and child tokens is an error: its children would be dropped.
- A token's CSS name is `--` plus its path joined by `-`.
- `tokens.css` is generated: a custom property per token, every one on the root element, an alias as `var()`, raw CSS verbatim, a font weight keyword as its DTCG number. The base is `:root`. Each other theme, each platform but the first that redefines a token, and each pair of the two follow as `:root[data-theme="<t>"]`, `:root[data-platform="<p>"]` and `:root[data-platform="<p>"][data-theme="<t>"]`, the specificity growing with the combination, each holding the tokens, resolved in `resolutionOrder`, whose text differs from what the blocks before it already give that root. After them, each breakpoint in resolver order is one `@media <query>` block repeating `:root` and those selectors under the same rule. Since all sit on one element, a `var()` computes against the final values and no dependent is written again. A composite token (shadow, border, typography, ...) has no CSS of its own: it needs a raw CSS extension to appear in it.
- A component or screen render loads it with `<link rel="stylesheet" href="../tokens.css">`, so a token change reaches every render without rewriting one. It sets `data-theme` and `data-platform` on `<html>` alone, V9: another theme or platform is another document, or the same one with that attribute toggled.
- A validated or deprecated element edited since its committed version, without a new `version`, is an error. A change to `status`, `code` or the History table is not an edit. A validated element is also held to the resolved value, in any theme, platform or breakpoint, of each token it or an element it uses declares, compared with the committed `tokens.css`; a token's value change leaves a deprecated element as it is.

## Responsibilities

| Part | Owns | Never |
| --- | --- | --- |
| Engine, `hooks/aidd-ui.cjs` and `hooks/lib/` | every rule and every write that needs no judgement; it sits in `hooks/` because the CLI ships only that folder of a plugin to every host, and several skills call it | decides a name, a brand or a style |
| Hook, `hooks/ui-hook.cjs` | the adapter: a host event in, the scoped `validate`, the host's output | holds a rule, writes in the project |
| Skill, `skills/01-system/` | what to do and when, the inputs it passes, the outputs it reads, the judgement: brand, names, primitives, style | restates a mechanical rule the engine applies |

## Commands

```sh
node <plugin>/hooks/aidd-ui.cjs validate [project-root]
node <plugin>/hooks/aidd-ui.cjs tokens [project-root]
node <plugin>/hooks/aidd-ui.cjs impact <id or token>… [--root <dir>]
node <plugin>/hooks/aidd-ui.cjs extract [--force] [--root <dir>]
node <plugin>/hooks/aidd-ui.cjs bump --task <aidd_docs/tasks/…> --change "<text>" [--breaking] <token or id>… [--root <dir>]
```

| Command | Does |
| --- | --- |
| `validate` | checks the whole design system |
| `tokens` | writes `aidd_docs/ui/tokens.resolver.json`, then `aidd_docs/ui/tokens.css`, and prints the stylesheet's path; writes no stylesheet and exits 1 while a token has an error or a composite token has no raw CSS. The resolver lists the themes, and the platforms and breakpoints that have a file; none is written while one theme and no such file ask for none |
| `impact` | prints as JSON the `tokens`, the tokens that hold a reached token's value in some context without citing it (`same-value`), and the `elements`, `screens`, `journeys`, `renders` and `code` files a change to those tokens or elements reaches, each sorted; a token is named by its path or its CSS name, and any token reached adds the `code-tokens` files to `code`; a name that is neither exits 2 |
| `extract` | writes the token files from the `code-tokens` files and prints `{"written": […], "left": [{file, line, name, why}]}`, the same bytes on a second run; exits 1 with a message when `system.md` or its `code-tokens` are missing, a file is unreadable, or `tokens.json` exists and `--force` is absent |
| `bump` | raises the versions a change to those refs reaches and prints `{"changed": […], "left": [{id, why}]}`, `left` naming each element reached and not raised, `deprecated` or `already raised for this task`, an element raised for the task having its History row turned to breaking, its change text extended with the new one after `; `, when a later change is `--breaking` and the row is not; exits 2 with a message, before any write, on an unknown ref, a task outside `aidd_docs/tasks/`, a change that is empty or holds a pipe or a line break, or a record it cannot raise |

### Extraction

`extract` reads, from each `code-tokens` file, only these shapes. A file's platform is the one its `code-tokens` item names, else its code root's, the first platform of `system.md` being the base.

| Read | Becomes |
| --- | --- |
| custom property in `:root` or `html` | a base token |
| custom property in `[data-theme="<t>"]` or `html[data-theme="<t>"]` | a `themes/<t>.json` token; the base theme's block next to `:root` in one rule is the base, alone it is left |
| custom property in `@media (min-width|max-width …) { :root {…} }` | a `breakpoints/<b>.json` token, the query verbatim; `<b>` is the breakpoint whose `## Breakpoints` row names every length of the query, else the next free one in order when as many are left as queries |
| `export const <name> = { key: "literal" or number }`, one level nested allowed | a base token, a key `colorAccent` being `color-accent`; the export's name is no part of it |
| a token another platform's file also holds with a different value | a `platforms/<p>.json` token |

| Value | Becomes |
| --- | --- |
| `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` or `rgba()` of numbers | a colour in srgb, its `hex` when opaque |
| `<n>px`, `<n>rem` | a dimension |
| `<n>ms`, `<n>s` | a duration |
| `var(--x)` alone | an alias to `x` |
| a bare number in a script | a px dimension when a word of its name is `size`, `radius`, `space` or `spacing`, else a number |
| anything else | raw CSS, typed `color` for a colour function and `fontFamily` for a font stack, else untyped |

- `--a-b-c` is the path `a.b.c`; when a shorter name is already a token, the rest joins its leaf, `color.accent` and `color.accent-hover`, so a path always gives its CSS name back.
- A context keeps only what differs from the base. A context value its base's type cannot hold stays CSS, so does an alias to a token of another type, and an alias to a token of no type is raw `var()` CSS, since nothing could type it.
- Left, with the file, the line, the name and why: a property in another selector or at-rule, an `@media` that is no width query or matches no breakpoint, a theme `system.md` does not declare, a script value that is no string or number literal, an object nested deeper than one level, a token citing a custom property that is no token, a file of neither kind, a bare token file under no code root while several platforms are declared, a token file naming a platform `system.md` does not declare, and a token only some of the platforms hold, which stays in the base.

### Bump

For each element or screen the refs reach: `version` +1, `status: proposed`, a History row `| <version> | <change> | yes or no | <task> |`. A deprecated one is left, or with `--breaking` raised as breaking and still deprecated when a ref is a token it cites, directly or through what it uses; an element whose latest History row already names the task is not raised again. Each review naming a raised screen gets, in its `## Verdicts`, one `pending` row per state at the new version. `code` links, `system.md` and `validated` are untouched.

## Validation

`validate` prints `VALID`, or one `✗ <file>: <message> (<rule>)` line per error and `⚠` per warning, and exits 1 when an error remains. Warnings: a file under a code root no record links, a colour literal in a code file identical to `HEAD`, a render length of 2px or less, and a failure of `git` in H8. A colour literal in a code file changed or untracked since `HEAD`, or where `git` cannot answer, whatever the reason, is an error that says which.

A hook runs the same check and prints the same text on every host, only the JSON around it differing: problem lines in the `validate` format, then at most one line `+N more errors: <command>`, the engine relative to the project when it sits under it. Nothing is printed when there is nothing to show.

| Moment | Prints |
| --- | --- |
| Session start | when an error exists, `aidd-ui: N errors` and the first 5 |
| After a write under `aidd_docs/ui/` or a code root | the errors of the written files, their record's render and the records citing it, or of all after a write to `system.md`, the tokens, a theme, a platform or a breakpoint, then the warnings of the written files only; 10 lines at most, errors first; the count line carries the errors cut and those elsewhere |
| After a shell command running the engine or naming `aidd_docs/ui/` | nothing, the turn is marked; any other shell command does nothing |
| End of a turn that wrote such a file or ran such a command | the errors, as a reason to continue, once; 10 lines at most, then the count line |

Rules: records R1 to R17, history H1 to H8, tokens T1 to T10, renders V1 to V9, code C1 to C9.

## Limits

- Without `node` on `PATH`, the hook does nothing.
- After a write, the problems reach the model in the same turn on Claude Code, Codex, Copilot CLI, OpenCode and Kilo. At turn end, OpenCode and Kilo receive the errors as the next prompt. A forced continuation is never asked again. The turn mark lives in the OS temp directory; without a session id, no end-of-turn check runs.
- Cursor: the hook protocol is handled and checked on a payload, with its camelCase events, `workspace_roots` and `additional_context` / `followup_message` output; `stop` was not observed in `cursor-agent -p`. The end-of-turn follow-up is asked once (`loop_count` 0), and the turn is marked by `conversation_id`. `cursor-agent` writes `~/.cursor/ai-tracking` even with its config and data directories overridden.
- Codex runs the hook only once you trust it; Copilot only in a folder it trusts, and says nothing otherwise.
- A file written by a shell command is not seen when it is written: the command is, so the turn end reads it, and only when it runs the engine or names `aidd_docs/ui/`. A file deleted by a patch is not seen.
- Windows is untested.
- A problem a write causes in a record that does not cite the written one, such as a use of a renamed id, appears at turn end only.
- The Resolver is read in one profile: `theme`, `platform` and `breakpoint` modifiers with file sources. Inline sources and other modifiers are not checked.
- Breakpoint blocks cascade in the stylesheet, where the Resolver applies one context: at a width two queries match, a token only the earlier one redefines keeps that value.
- A loop only two breakpoints form together, at a width both queries match, is not named.
- A breakpoint file no resolver context names is not read.
- Composite tokens are checked for a `$value`, not for its shape, and reach `tokens.css` only as raw CSS.
- `impact` leaves reviews out of its report; `same-value` compares resolved CSS text, so two spellings of one colour differ.
- `extract` keeps the last of a custom property declared twice in a context, merges two files of one platform the same way, reads a script key `colorBGPrimary` as `color-b-g-primary`, writes a value with `!important` as raw CSS with it, and replaces the files it writes without removing one an earlier run left.
- `bump` does not see a review that lives in a task folder.
- A loop that only two contexts of two modifiers form together, and breakpoints that match at once with a pair of contexts, are not named: a pair resolves one breakpoint at a time.
- The committed baseline of H8 is `HEAD`: without `git`, a repository, a commit or the committed file, the rule is silent, and committing an edit without raising the version hides it. Any other failure of `git`, such as a repository it refuses to read or its five-second timeout, is one H8 warning on `aidd_docs/ui`, naming the failure. A run asks `git` once which files changed, then reads only those, plus the committed record of an element using a token whose value changed; C4 asks at most twice more when it finds a literal, naming each file that holds one.
- A version raise that stays `validated` passes until a review can prove it.
- H8 does not watch an asset's file, a journey or `brand.md`.
- C4 reads the state against `HEAD`: a committed literal is only a warning, so a clean checkout fails it only through a committed symlink, whose target git cannot match. A `git mv` or any edit of a debt file also turns its literals into errors.
- A `tokens.css` kept out of git by `.gitignore` has no committed baseline, which disables H8's token-value part: commit it.
- A blank line added to a held record, inside a body too, counts as an edit for H8.
- A `;` inside a raw `url()` hides a change of that value from H8.
- Deleting a validated record is not caught.
- A Task cell's folder is not checked for existence.
- Two token paths with one CSS name are not detected.
- An opaque colour with a `hex` is written as that `hex`, which drops a wider gamut its `colorSpace` holds.
- A review validates screens only for now, so components are validated by hand until the review page exists.
- `code-roots` and `ignore` are path prefixes, not globs. Every folder under a code root is walked, `node_modules`, build output and dot-folders included: ignore them. A linked folder counts as one file no record links.
- A render shows a variant or state when its text holds the attribute, whatever the element; an export exists when its name is a word of the linked file, a comment included, so `stylesheet#word` passes C1 and covers the whole stylesheet.
- The hook command names `${CLAUDE_PLUGIN_ROOT}` unquoted, like every plugin here, and the OpenCode and Kilo bridges replay only that exact form: a plugin path with spaces breaks it.
- In code, only colour literals are found, outside tests and mocks, which C3 leaves out of the backlog too; other literals are left to the UI audit. A test is a file in a `__tests__` or `__mocks__` folder or named `.test.` or `.spec.`, whatever the techno.
- Under a code root, documents (`.md`, `.mdx`, `.txt`, `.rst`, `.adoc`), data (`.json`, `.yaml`, `.yml`, `.csv`, `.toml`, `.xml`), images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.ico`, `.bmp`, `.svg`), fonts (`.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`) and any file with a NUL byte in its first 8000 are neither covered by C3 nor scanned by C4.
- Stylesheets and `.html` are read whole. Every other file, scripts and `.vue` and `.svelte` and any techno included, has its colours found in string literals only, comments left out; an `.astro` file also in its `<style>` blocks. A colour written as a number, such as Dart's `0xFF336699`, or by a constructor, is not found.
- A path link takes no `platform=` prefix, its code root decides; a path link to a file under no code root has no platform, which is an error once several are declared.
- A word of hex letters after `#` in a stylesheet, a string or a colour attribute, such as `#add` or `url(#add)`, counts as a colour. A named colour, such as `red`, is not found.
- Fixed widths on text and long translations are left to the UI audit.

## Try it from a checkout

| Scope | Run |
| --- | --- |
| This session only | `claude --plugin-dir plugins/aidd-ui` |
| Persistent | `/plugin marketplace add .`, then `/plugin install aidd-ui@aidd-framework` |
