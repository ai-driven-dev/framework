# Content rewrite

`rewriteContent(content: string): string` is declared by `AiTool` in `domain/profile.ts` and implemented in each `domain/profiles/<tool>/profile.ts`. Every file that reaches a tool's tree passes through it.

## Callers

| Path | Caller |
| --- | --- |
| install | `contexts/installation/application/install/content/install-content-section.ts` |
| translate | `contexts/translate/domain/engine.ts` |

## Contract

- One direction, one argument, per tool; there is no reverse and no shared base helper.
- The CLI writes owned files from the canonical source and never reads a tool's tree back, so an inverse has no caller.
- `DOCS_DIR` is a constant in `shared/domain/paths.ts`; a profile that needs it imports it.

## What a profile does

| Profile | Rewrite |
| --- | --- |
| `antigravity` | none, the identity |
| `claude` | its numbered command directories |
| `opencode`, `kilo`, `cursor` | command directories, and for `cursor` `.md` rule references to `.mdc` |
| `codex` | `rewriteCodexContent` |
| `copilot` | `rewriteCopilotContent` turns `@{{TOOLS}}/` and `@{{DOCS}}/` into markdown links, because Copilot resolves no `@`-include |

- `{{TOOLS}}/` without `@` replaces a directory prefix only, for frontmatter and prose.
- `@{{TOOLS}}/` resolves to a full installed path.

## The trap

- An identity rewrite looks the same as one that was forgotten, until a placeholder reaches a user's file verbatim.
- Prove a rewrite with a fixture that contains the placeholder, and assert the whole rewritten string.
- `tests/contexts/tools/domain/profiles/copilot/content.unit.test.ts` is the model.
