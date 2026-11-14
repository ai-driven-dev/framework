# Codebase Map

Where things live. The architecture rules carry no paths on purpose, so this is the single place that says. `tests/architecture/codebase-map.arch.test.ts` holds it to the tree in both directions.

```txt
src/
├── composition/    # one wiring module per migrated context, composed by the root until it moves here
├── contexts/    # bounded contexts — no barrel, nothing reaches inside another
│   ├── auth/    # the one GitHub token: where it is read, stored and checked
│   │   ├── application/
│   │   ├── contract/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── distribution/    # where content comes from and how it is fetched
│   │   ├── application/
│   │   ├── domain/
│   │   │   └── catalog-parsers/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── framework/    # the installation record and everything done to a project
│   │   ├── application/
│   │   │   ├── clean/
│   │   │   ├── doctor/
│   │   │   ├── flows/
│   │   │   ├── framework/
│   │   │   │   └── translator/
│   │   │   ├── global/
│   │   │   ├── install/
│   │   │   │   └── content/
│   │   │   ├── ownership/    # machine plugin claims and safe project detach
│   │   │   ├── plugin/
│   │   │   ├── restore/
│   │   │   ├── setup/
│   │   │   ├── shared/
│   │   │   └── uninstall/
│   │   ├── domain/
│   │   │   ├── formats/
│   │   │   ├── manifest/
│   │   │   ├── plugins/
│   │   │   ├── ports/
│   │   │   └── reading/    # the home directory a use case resolves when none is given
│   │   └── infrastructure/
│   │       └── assets/    # configs inlined at build time, schemas copied beside the binary
│   ├── recipes/    # checking a recipe's structure, examples and local links
│   │   ├── application/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── tools/    # what a project targets, and what each target declares
│   │   ├── application/
│   │   ├── contract/
│   │   └── domain/
│   │       ├── bridges/    # the generated event modules of the hosts that read no hooks file
│   │       ├── formats/
│   │       ├── hooks/
│   │       ├── native-registration/    # the native host's plugin CLI and marketplace declarations, held as data
│   │       ├── profile.ts    # the sections a profile declares and the shape a defined tool has
│   │       ├── profile/
│   │       ├── profiles/    # one directory per tool
│   │       │   ├── antigravity/
│   │       │   ├── claude/
│   │       │   ├── codex/
│   │       │   ├── copilot/
│   │       │   ├── cursor/
│   │       │   ├── kilo/
│   │       │   ├── opencode/
│   │       │   └── vscode/
│   │       └── sections/    # the parts a profile is made of: one class per section it declares
│   ├── host-registration/    # what a host's own registry says about plugins and marketplaces, and the driving of its CLI
│   │   ├── contract/
│   │   └── infrastructure/
│   ├── telemetry/    # what each billed model call consumed, read from a tool's own transcripts
│   │   ├── application/
│   │   │   ├── forget/    # what measurement keeps on a machine, shown and erased
│   │   │   ├── identity/    # who, if anyone, the measurement names
│   │   │   ├── report/    # what the stored calls consumed in a period, along one axis
│   │   │   └── switch/    # opting a repository in or out
│   │   ├── domain/
│   │   │   ├── declaration/    # the task a person declares, and whether work is bound to one
│   │   │   ├── formats/
│   │   │   ├── consent/    # a clone's identity, and when it consented
│   │   │   ├── identity/    # the identifier a person chose to be named by
│   │   │   ├── legacy/    # where an earlier version wrote what forget erases, and the table of ids it gave repositories
│   │   │   ├── report/    # attribution of a call, the days of a report, the axes it splits by
│   │   │   └── switch/    # Claude's retention
│   │   ├── ports/
│   │   │   ├── bindings/    # the declarations kept beside the ledger, and the lock their writers share
│   │   │   ├── forget/
│   │   │   ├── identity/
│   │   │   └── switch/
│   │   └── infrastructure/
│   │       ├── git/    # every git child process: the executor, its environment, and what git config and branches answer
│   │       ├── legacy/    # the table of ids an earlier version wrote beside the ledger, read and never written
│   │       ├── reading/    # reading a text file safely, for the stores under the telemetry dir
│   │       ├── sources/    # a tool's own session files and settings, one folder per tool
│   │       │   ├── claude/    # Claude Code: the journal files, the projects root, the retention setting
│   │       │   └── codex/    # Codex: the session files, their zstd frames and their line format
│   │       └── storage/    # the owner-only files under the telemetry dir
│   │           ├── consent/    # a clone's identity read from the file system, and the consent history file
│   │           ├── declarations/    # the declarations kept beside the ledger, and the lock their writers share
│   │           └── ledger/    # the calls, their resolution, the branch snapshots and what an ingest left out
│   ├── translate/    # canonical source to target-native content
│   │   ├── application/
│   │   │   └── strategies/
│   │   ├── domain/
│   │   │   ├── formats/
│   │   │   └── ports/
│   │   └── infrastructure/
│   └── update/    # replacing the installed CLI with its latest release, and the notice that one exists
│       ├── application/
│       ├── domain/
│       ├── infrastructure/
│       └── ports/
├── shared/    # what two or more contexts need. Imports no context
│   ├── domain/    # the vocabulary: tool identity, source, paths, files, merge strategies, errors
│   │   ├── materialization/    # where content lands and how its links follow
│   │   └── reading/    # getting at a file's location and its content safely
│   ├── infrastructure/    # adapters of the shared ports, imported by the composition root only
│   └── ports/    # a technology port two or more contexts need
└── presentation/    # everything that talks to a human — depends on contexts, never the reverse
    ├── commands/    # one file per command, wiring only
    ├── display/    # rendering a result
    │   └── telemetry/    # the telemetry report, which outgrew one file beside the others
    ├── hooks/    # what runs around every command: the update notice before it, the refresh after
    ├── prompts/    # asking the user; the decision stays in the context
    └── terminal/    # the prompt adapter over the terminal
```

## Areas

- `src/composition/`: the wiring module of each migrated context. Only the composition root and `cli.ts` import it; commands receive its factories typed by `presentation/deps.ts`.
- `src/shared/`: the vocabulary, technology ports and adapters that two or more contexts need. No context import; a module imported by fewer than two contexts does not belong (`earned-sharing.arch.test.ts`).
- `src/contexts/`: the nine bounded contexts. Nothing reaches inside another; the allowed edges are in `architecture.md`.
- `src/presentation/`: commands, rendering, prompts. Depends on contexts, never the reverse.
- `tests/`: mirrors `src/`, one tier per file extension. `tests/architecture/` holds the ratchets, `tests/golden/` the snapshots, `tests/helpers/ports/` the doubles.
- `assets/`: configs inlined at build time, schemas copied beside the binary.
- `scripts/`: bundle budget, mutation runner, smoke harness, the copy check between tool profiles.

## Entry points

- `src/cli.ts` → `dist/cli.js`, bin `aidd`.
- `src/composition/framework.ts` — the composition root. Start here when wiring anything.

## Where to add things

| What | Where |
| ---- | ----- |
| a command | `presentation/commands/`, plus the use case in whichever context owns the concept |
| a prompt | `presentation/prompts/`; the decision it feeds stays in the context |
| a use case | the context whose concept it serves. There is no landing zone: one that fits nowhere means the contexts are wrong |
| a tool | one profile directory under `contexts/tools/domain/profiles/` |
| a transform shared by two profiles | `contexts/tools/domain/formats/`; used by one, that profile's own directory |
| a port used by one context | that context's `domain/ports/` (`ports/` in a migrated context), adapter in its `infrastructure/` |
| a port used by two | `shared/ports/`, adapter in `shared/infrastructure/` |
| a context's wiring | `composition/<context>.ts`, called by `composition/framework.ts` |
