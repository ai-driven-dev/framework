---
status: implemented
---

# Instruction: Surgical hook, generated resolver

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-ui/
│   ├── README.md                         ✏️ hook output, resolver, limits
│   ├── hooks/
│   │   ├── hooks.json                    ✏️ PostToolUse also on shell commands
│   │   ├── ui-hook.cjs                   ✏️ one lean output, a turn marked by an engine command
│   │   └── lib/                          ✏️ resolver written from system.md
│   └── skills/01-system/                 ✏️ no resolver JSON to copy, Breakpoints query column
└── scripts/__tests__/                    ✏️ aidd-ui tests
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | fixture with two themes, a breakpoint and a platform declared in `system.md` | ready | system |
| Happy path   | run `tokens` with no resolver | `tokens.resolver.json` written from `system.md`, stylesheet generated, VALID | cli |
| Happy path   | a write breaking one record | the hook prints only that record's errors, at most 10 lines, one count line for the rest, the same text on every host | system |
| Edge case    | a turn writing only through an engine command | the turn is marked; Stop blocks once on its errors | system |
| Edge case    | a clean write | the hook prints nothing | system |

## Tasks to do

### `1)` Resolver written by the engine

1. `tokens` writes `tokens.resolver.json` from `system.md`: themes, breakpoints with the `Query` column of `## Breakpoints`, platforms; `extract` uses the same writer.
2. The skill and README drop the resolver JSON examples; the model never writes the resolver.

### `2)` Surgical hook output

1. After a write: errors of the written files and what they reach, warnings of the written files only, at most 10 lines, then one line counting the rest; nothing when clean.
2. Stop and session start: the same line format, errors only, capped.
3. One text for every host; only the envelope differs.

### `3)` Engine commands seen

1. PostToolUse also fires on shell commands; a command running the engine or writing under `aidd_docs/ui/` marks the turn, printing nothing.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | a fixture without resolver validates after `tokens`; the skill holds no resolver JSON |
| 2 | each host's payload gives the exact expected text; a clean write prints nothing |
| 3 | a turn with only `bump` blocks once at Stop on an error it left |
