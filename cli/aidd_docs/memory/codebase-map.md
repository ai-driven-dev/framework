# Codebase Map

Where things live. `tests/architecture/docs-do-not-lie.arch.test.ts` holds the tree to the directories in both directions.

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
│   │   │   ├── add/
│   │   │   ├── plugin-source/
│   │   │   └── remove/
│   │   ├── contract/
│   │   ├── domain/
│   │   │   └── catalog-parsers/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── host-registration/    # what a host's registry says, and driving its CLI
│   │   ├── application/
│   │   │   ├── inspect/
│   │   │   ├── register/
│   │   │   │   └── marketplace/
│   │   │   └── withdraw/
│   │   │       └── prove/
│   │   ├── contract/
│   │   ├── domain/
│   │   │   ├── policy/
│   │   │   ├── reading/
│   │   │   ├── record/
│   │   │   └── source/
│   │   ├── infrastructure/
│   │   │   ├── marketplace/
│   │   │   └── plugin-registry/
│   │   └── ports/
│   ├── installation/    # the installation record and what installs, restores and materializes it
│   │   ├── application/
│   │   │   ├── agents/
│   │   │   ├── clean/
│   │   │   ├── doctor/
│   │   │   ├── install/
│   │   │   │   └── config/
│   │   │   ├── marketplace/
│   │   │   ├── materialize/
│   │   │   │   └── built/
│   │   │   ├── ownership/
│   │   │   ├── plugin/
│   │   │   │   ├── add/
│   │   │   │   └── files/
│   │   │   ├── removal/
│   │   │   │   └── project/
│   │   │   ├── restore/
│   │   │   │   └── project/
│   │   │   ├── shared/
│   │   │   ├── status/
│   │   │   ├── sync/
│   │   │   └── update/
│   │   ├── contract/
│   │   ├── domain/
│   │   │   ├── manifest/
│   │   │   └── plugins/
│   │   ├── infrastructure/
│   │   │   └── assets/
│   │   └── ports/
│   │       ├── plugin/
│   │       ├── record/
│   │       └── user-scope/
│   ├── machine-claims/    # which projects claim a machine-wide plugin or source
│   │   ├── application/
│   │   │   ├── ownership/
│   │   │   ├── record/
│   │   │   ├── removal/
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
│   │   │   ├── ledger/
│   │   │   ├── legacy/
│   │   │   ├── report/
│   │   │   ├── resolution/
│   │   │   ├── switch/
│   │   │   └── transcript/
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
│   │   ├── domain/
│   │   │   ├── bridges/
│   │   │   ├── formats/
│   │   │   │   ├── agents/
│   │   │   │   ├── hooks/
│   │   │   │   └── mcp/
│   │   │   ├── hooks/
│   │   │   ├── models/
│   │   │   ├── native-registration/
│   │   │   ├── profile/
│   │   │   ├── profiles/
│   │   │   │   ├── antigravity/
│   │   │   │   ├── claude/
│   │   │   │   ├── codex/
│   │   │   │   ├── copilot/
│   │   │   │   ├── cursor/
│   │   │   │   ├── kilo/
│   │   │   │   ├── opencode/
│   │   │   │   └── vscode/
│   │   │   └── sections/
│   │   └── infrastructure/
│   ├── translate/    # canonical source to target-native content
│   │   ├── application/
│   │   │   └── sinks/
│   │   ├── contract/
│   │   ├── domain/
│   │   │   ├── layouts/    # where each sink puts a plugin, as data for the rules
│   │   │   └── rules/    # the one rule set both sinks write content with
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
│   ├── domain/
│   ├── marketplace/
│   │   └── remove/
│   ├── menu/
│   ├── plugin/
│   ├── ports/    # the Prompter port, implemented by presentation
│   ├── setup/
│   │   └── steps/
│   ├── sync/
│   │   └── settings/
│   └── telemetry/
├── presentation/    # everything that talks to a human
│   ├── controllers/
│   │   ├── doctor/
│   │   ├── menu/
│   │   ├── plugin/
│   │   ├── setup/
│   │   ├── telemetry/
│   │   └── tools/
│   ├── errors/
│   ├── hooks/
│   ├── presenters/
│   │   ├── plugin/
│   │   ├── setup/
│   │   ├── telemetry/
│   │   └── tools/
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
| a command | `presentation/controllers/`, its logic in the context that owns the concept |
| a tool | one directory under `contexts/tools/domain/profiles/`, procedure in the `tools` skill |
| a port used by one context | its `ports/`, adapter in its `infrastructure/` |
| a port used by two | `shared/ports/`, adapter in `shared/infrastructure/` |
