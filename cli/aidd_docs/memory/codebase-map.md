# Codebase Map

Where things live. `tests/architecture/codebase-map.arch.test.ts` holds the tree to the directories in both directions.

```txt
src/
├── composition/    # one wiring module per context, called by container.ts
│   └── orchestration/    # the wiring of each scenario
├── contexts/    # bounded contexts; another context reads contract/ only, presentation and orchestration also application/
│   ├── auth/    # the one GitHub token
│   │   ├── application/
│   │   ├── contract/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── distribution/    # where content comes from and how it is fetched
│   │   ├── application/
│   │   │   ├── plugin-source/
│   │   │   └── remove/
│   │   ├── contract/
│   │   ├── domain/
│   │   │   └── catalog-parsers/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── host-registration/    # what a host's registry says, and driving its CLI
│   │   ├── application/
│   │   │   └── inspect/
│   │   ├── contract/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── installation/    # the installation record and what installs, restores and materializes it
│   │   ├── application/
│   │   │   ├── agents/
│   │   │   ├── doctor/
│   │   │   ├── install/
│   │   │   │   ├── config/
│   │   │   │   └── content/
│   │   │   ├── marketplace/
│   │   │   ├── materialize/
│   │   │   ├── ownership/
│   │   │   ├── plugin/
│   │   │   ├── removal/
│   │   │   ├── restore/
│   │   │   │   └── project/
│   │   │   ├── shared/
│   │   │   ├── sync/
│   │   │   └── update/
│   │   ├── contract/
│   │   ├── domain/
│   │   │   ├── manifest/
│   │   │   └── plugins/
│   │   ├── infrastructure/
│   │   │   └── assets/
│   │   └── ports/
│   │       └── plugin/
│   ├── machine-claims/    # which projects claim a machine-wide plugin or source
│   │   ├── application/
│   │   │   └── shared-source/
│   │   ├── contract/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── recipes/    # checking a recipe
│   │   ├── application/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── telemetry/    # what each billed model call consumed
│   │   ├── application/
│   │   │   ├── declaration/
│   │   │   ├── forget/
│   │   │   ├── identity/
│   │   │   ├── report/
│   │   │   └── switch/
│   │   ├── contract/
│   │   ├── domain/
│   │   │   ├── consent/
│   │   │   ├── declaration/
│   │   │   ├── identity/
│   │   │   ├── legacy/
│   │   │   ├── report/
│   │   │   └── switch/
│   │   ├── infrastructure/
│   │   │   ├── git/
│   │   │   ├── legacy/
│   │   │   ├── reading/
│   │   │   ├── sources/
│   │   │   │   ├── claude/
│   │   │   │   └── codex/
│   │   │   └── storage/
│   │   │       ├── consent/
│   │   │       ├── declarations/
│   │   │       └── ledger/
│   │   └── ports/
│   │       ├── bindings/
│   │       ├── forget/
│   │       ├── identity/
│   │       └── switch/
│   ├── tools/    # what a project targets, and what each target declares
│   │   ├── application/
│   │   ├── contract/
│   │   └── domain/
│   │       ├── bridges/
│   │       ├── formats/
│   │       ├── hooks/
│   │       ├── models/
│   │       ├── native-registration/
│   │       ├── profile/
│   │       ├── profiles/
│   │       │   ├── antigravity/
│   │       │   ├── claude/
│   │       │   ├── codex/
│   │       │   ├── copilot/
│   │       │   ├── cursor/
│   │       │   ├── kilo/
│   │       │   ├── opencode/
│   │       │   └── vscode/
│   │       └── sections/
│   ├── translate/    # canonical source to target-native content
│   │   ├── application/
│   │   │   └── sink/
│   │   ├── contract/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── ports/
│   └── update/    # replacing the installed CLI, and the notice that one exists
│       ├── application/
│       ├── domain/
│       ├── infrastructure/
│       └── ports/
├── orchestration/    # scenarios that chain contexts, no business rule
│   ├── agent-models/
│   ├── clean/
│   ├── doctor/
│   ├── global/
│   ├── marketplace/
│   ├── plugin/
│   ├── setup/
│   └── sync/
├── presentation/    # everything that talks to a human
│   ├── commands/
│   ├── display/
│   │   └── telemetry/
│   ├── hooks/
│   ├── prompts/
│   └── terminal/
└── shared/    # what two or more contexts need
    ├── domain/    # the vocabulary
    │   ├── layout/
    │   ├── materialization/
    │   ├── plugin/
    │   └── reading/
    ├── infrastructure/    # adapters of the shared ports, wired by composition only
    └── ports/    # technology ports two or more contexts need
```

## Areas

| Path | Holds |
| --- | --- |
| `src/composition/` | the wiring; imported by the composition root and `cli.ts` only |
| `src/shared/` | what two or more contexts need; `earned-sharing.arch.test.ts` |
| `tests/` | mirrors `src/`, one tier per file extension; `architecture/` holds the guards, `golden/` the snapshots, `helpers/ports/` the doubles |
| `assets/` | configs inlined at build time, schemas copied beside the binary, hook runtimes |
| `scripts/` | bundle budget, mutation runner, smoke harness, profile-copy check |

## Entry points

| Entry | Path |
| --- | --- |
| Binary | `src/cli.ts` to `dist/cli.js`, bin `aidd` |
| Wiring | `src/composition/container.ts` |

## Where to add

| What | Where |
| --- | --- |
| a command | `presentation/commands/`, its logic in the context that owns the concept |
| a tool | one directory under `contexts/tools/domain/profiles/`, procedure in the `tools` skill |
| a port used by one context | its `ports/`, adapter in its `infrastructure/` |
| a port used by two | `shared/ports/`, adapter in `shared/infrastructure/` |
