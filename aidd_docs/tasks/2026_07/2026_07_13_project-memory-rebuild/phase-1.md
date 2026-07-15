---
status: done
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Router and scan

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
plugins/aidd-context/skills/02-project-memory/
├── SKILL.md                              ✏️ router: mermaid scan->generate->sync, 3-action table, rules, ref/asset lists
├── actions/
│   └── 01-scan.md                        ✅ detect tools + capabilities, user picks tools, confirms capabilities
└── references/
    ├── tools.md                          ✅ tool | detected-when | context-file (merges detection signals + the AI map)
    └── capability-signals.md             ✏️ keep the table, strip prose to one-line intents
```

## Tasks to do

### `1)` Rewrite SKILL.md as a router

> The always-on description and the smallest body that routes.

1. Frontmatter: `name`, a `description` under ~45 tokens naming the journey not the mechanism, `argument-hint: scan | generate | sync`.
2. Body: a linear mermaid `scan --> generate --> sync`, then a 3-row action table (verb, one-line does).
3. Carry the load-bearing line: run in order, read the action's file in `actions/` before running it.
4. Keep the transversal Memory rules and Action rules, one idea per line, no semicolons.
5. Carry no reference or asset list: the actions point at them with `@`, and onboard proves the list is pure duplication.

### `2)` Write actions/01-scan.md

> Detect, ask, confirm. Read only, one prompt.

1. Detect the tools present per `references/tools.md` (detected-when column).
2. Show the detected tools, let the user pick one or several, wait for the pick, never default to all.
3. Detect the capabilities per `references/capability-signals.md`, each with its repo evidence.
4. Show each capability with evidence, let the user confirm, add, or drop, block on the answer.
5. Output: the confirmed tool set and confirmed capability set, rendered nowhere.

### `3)` Write references/tools.md

> One table keyed by tool, serving scan and sync.

1. Columns: tool, detected-when (its own dir or a file only it reads), context-file (where the block lives).
2. Rows: claude, codex, cursor, opencode, copilot, matching the current mapping paths.
3. A note: a shared `AGENTS.md` is a wiring target, never a detection signal.

### `4)` Trim references/capability-signals.md

> Keep the capability/definition/evidence/folder table, cut the surrounding prose to intents.

1. Reduce the two prose paragraphs to the load-bearing rules only (a capability holds on a concrete fact, no inferred domain, every fire shown with evidence).
2. Leave the table and the template folders untouched.

## Test acceptance criteria

<!-- Each criterion is an observable behavior, not a command. -->

| Task | Acceptance criteria                                                                     |
| ---- | --------------------------------------------------------------------------------------- |
| 1    | SKILL.md holds a mermaid, a 3-row table, the read-the-action-file line, and a sub-45-token description. |
| 2    | scan detects tools, offers a multi-pick, and confirms capabilities with evidence, rendering no memory. |
| 3    | tools.md maps every listed tool to a detected-when signal and a context-file path.       |
| 4    | capability-signals.md keeps its table and carries no prose beyond the holding rules.      |
