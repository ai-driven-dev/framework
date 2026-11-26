# CLI Codebase Map

Where CLI code lives. `cli/tests/architecture/docs-do-not-lie.arch.test.ts` holds this tree, two levels deep, to `cli/src/` in both directions. The layers inside a context are in the `working-on-cli` skill's [`references/architecture.md`](../../../../.claude/skills/working-on-cli/references/architecture.md).

```txt
src/
├── composition/    # container.ts and the shared wiring
│   ├── contexts/    # one wiring module per context, called by container.ts
│   ├── orchestration/    # the wiring of each scenario
│   └── tool-profiles/    # one profile per tool; the registration list sits beside it
├── contexts/    # bounded contexts; another context reads contract/ only, presentation and orchestration also application/
│   ├── auth/    # the one GitHub token
│   ├── distribution/    # where content comes from and how it is fetched
│   ├── host-registration/    # what a host's registry says, and driving its CLI
│   ├── installation/    # the installation record and what installs, restores and materializes it
│   ├── machine-claims/    # which projects claim a machine-wide plugin or source
│   ├── recipes/    # checking a recipe
│   ├── telemetry/    # what each billed model call consumed
│   ├── tools/    # what a project targets, and what each target declares
│   ├── translate/    # canonical source to target-native content
│   └── update/    # replacing the installed CLI, and the notice that one exists
├── orchestration/    # scenarios that chain contexts, no business rule
│   ├── agent-models/
│   ├── clean/
│   ├── doctor/
│   ├── marketplace/
│   ├── menu/
│   ├── plugin/
│   ├── ports/    # the Prompter port, implemented by presentation
│   ├── setup/
│   ├── sync/
│   └── telemetry/
├── presentation/    # everything that talks to a human
│   ├── controllers/
│   ├── errors/
│   ├── hooks/
│   ├── menu/
│   ├── presenters/
│   └── terminal/
└── shared/    # what two or more contexts need
    ├── domain/    # the vocabulary
    ├── infrastructure/    # adapters of the shared ports, wired by composition only
    └── ports/    # technology ports two or more contexts need
```

## Areas

| Path | Holds |
| --- | --- |
| `cli/src/composition/` | the wiring; imported only by the composition root and `cli/src/cli.ts` |
| `cli/src/shared/` | what two or more contexts need; `cli/tests/architecture/earned-sharing.arch.test.ts` |
| `cli/tests/` | mirrors `cli/src/`, one tier per file suffix; `architecture/` guards, `golden/` snapshots, `cli/tests/shared/testing/` builders |
| `cli/assets/` | configs inlined at build time, schemas copied beside the binary, hook runtimes (`host-*.cjs` generated from `hooks-runtime/parts/`: edit the template, then `node scripts/check/run.cjs --fix`) |
| `cli/scripts/` | bundle budget, mutation runner, smoke harnesses, profile-copy check |

## Entry points

| Entry | Path |
| --- | --- |
| Wiring | `cli/src/composition/container.ts` |

## Where to add

| What | Where |
| --- | --- |
| a command | `presentation/controllers/`; its logic in the context owning the concept |
| a tool | one profile in `composition/tool-profiles/` plus its line in `tool-profiles/index.ts`; procedure in the `working-on-cli` skill's `actions/01-tool.md` |
| a port used by one context | its `ports/`, adapter in its `infrastructure/` |
| a port used by two | `shared/ports/`, adapter in `shared/infrastructure/` |
