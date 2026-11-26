# Content rewrite

`linkSyntax: LinkSyntax` is declared by the profile (`domain/profile.ts`, `contract/tool-profile.ts`): an ordered list of `{ from, to }` rules, as data. Every markdown file that reaches a tool's tree is read through it by `toolLinks` and `applyLinkSyntax` (`translate/domain/rules/links.ts`, `shared/domain/materialization/link-syntax.ts`); any other file is carried byte for byte (`isProse` in `translate/domain/plugin-paths.ts`).

## Callers

| Path | Caller |
| --- | --- |
| translate | `contexts/translate/domain/layouts/install-native.ts`, `install-flat.ts`, `install-native-hooks.ts` |

## Contract

- One direction, one list of rules, per tool; there is no reverse and no shared base.
- The CLI writes owned files from the canonical source and never reads a tool's tree back, so an inverse has no caller.
- `DOCS_DIR` is a constant private to `domain/behaviours/copilot/copilot-content.model.ts`, its only user.

## What a profile does

| Profile | Rewrite |
| --- | --- |
| `antigravity`, `kiro`, `kimi` | none, the identity |
| `claude` | its numbered command directories |
| `opencode`, `kilo`, `cursor` | command directories, and for `cursor` `.md` rule references to `.mdc` |
| `codex` | `.codex/skills/` to `.agents/skills/aidd-`, and its numbered command directories |
| `copilot` | `COPILOT_LINK_SYNTAX` turns `@{{TOOLS}}/` and `@{{DOCS}}/` into markdown links, because Copilot resolves no `@`-include |

- `{{TOOLS}}/` without `@` replaces a directory prefix only, for frontmatter and prose.
- `@{{TOOLS}}/` resolves to a full installed path.

## The trap

- An identity rewrite looks the same as one that was forgotten, until a placeholder reaches a user's file verbatim.
- Prove a rewrite with a fixture that contains the placeholder, and assert the whole rewritten string.
- `tests/contexts/tools/domain/behaviours/copilot/copilot-content.model.unit.test.ts` is the model.
