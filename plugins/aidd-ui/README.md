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

## How it works

```mermaid
flowchart LR
  Skill["skill 01-system"] -->|"judgement: brand, names, style"| Docs[("aidd_docs/ui/")]
  Skill -->|"calls"| Engine["hooks/aidd-ui.cjs"]
  Engine -->|"validate, tokens, impact, extract, bump, publish"| Docs
  Host["host event"] --> Hook["hooks/ui-hook.cjs"]
  Hook -->|"checks what a write produced, then what the turn reached"| Engine
  Hook -->|"problems"| Host
```

## Start

1. Install the plugin; its hook needs `node` on `PATH`.
2. Run `/aidd-ui:01-system` in your project.
3. Follow the skill: it writes the design system under `aidd_docs/ui/`.

## Limits

- The hook command names `${CLAUDE_PLUGIN_ROOT}` unquoted, and the OpenCode and Kilo bridges replay only that form: a plugin path with spaces breaks it.
- Cursor: the stop is proven on a payload, not in `-p`.
- After a write the hook reports only the lines the write added or changed; what it broke in other files waits for Stop. Stop checks the files the turn wrote, then what their writes reached; once the turn deleted a file or a shell command marked it, it reports every other error, since the hook cannot tell what cited the file or which files the command wrote. It reports no warning.
- Every problem prints as `<file>[:<line>] <rule> ["<excerpt>"] => <fix>` under a line counting errors and warnings; the hook never cuts the errors, and caps the warnings at ten.
- A shell write the hook does not know is not seen; it knows redirections, `tee`, `sed -i`, `mv`, `cp`, `rm`, `touch`, `mkdir`, `patch`, `git apply`, `checkout`, `restore` and the engine.
- Overlapping breakpoint queries cascade in the stylesheet: at a width two match, the later keeps a token the earlier alone redefines.
- A palette constant in code (`Colors.blue`, `UIColor.systemBlue`) is a name, as a token is: no colour check finds it. A storyboard's `<color red=…>` is not read either.
- A render shows a variant or state when its text holds the attribute; native behaviour (focus, validity) no render shows.
