# Codebase Map

Where things live. The architecture rules carry no paths on purpose, so this is the single place that says. `tests/architecture/codebase-map.arch.test.ts` holds it to the tree in both directions.

```txt
src/
├── composition/    # one wiring module per migrated context, composed by the root until it moves here
│   └── orchestration/    # the root's graph: one wire module per scenario
├── contexts/    # bounded contexts — no barrel, nothing reaches inside another
│   ├── auth/    # the one GitHub token: where it is read, stored and checked
│   │   ├── application/
│   │   ├── contract/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── distribution/    # where content comes from and how it is fetched
│   │   ├── application/
│   │   │   ├── plugin-source/    # which source a plugin comes from, whether it is trusted, and a search over them
│   │   │   └── remove/
│   │   ├── contract/
│   │   ├── domain/
│   │   │   └── catalog-parsers/
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── installation/    # the installation record, and what installs, restores and materializes it into a project
│   │   ├── application/
│   │   │   ├── agents/    # the provider each tool's agents run on, and the main session's model in the tool's user settings
│   │   │   ├── doctor/    # the checks over what the manifest tracks
│   │   │   ├── install/
│   │   │   │   └── content/
│   │   │   ├── marketplace/    # what a marketplace holds in a project: its plugin sources, and the plugins removed with it
│   │   │   ├── materialize/    # a plugin's files translated for one tool and written
│   │   │   ├── ownership/
│   │   │   ├── plugin/
│   │   │   ├── removal/    # a plugin removed from a project, its machine claims released through injected functions
│   │   │   ├── restore/
│   │   │   │   └── project/    # a project restored from its own record, whole or one tool
│   │   │   ├── shared/
│   │   │   ├── sync/    # a project's or the machine's manifest brought in line with the tools' settings and native registrations
│   │   │   └── update/    # one installed tool brought to the current version
│   │   ├── contract/    # what installation reports about a project: doctor issues and the project context
│   │   ├── domain/
│   │   │   ├── manifest/
│   │   │   └── plugins/
│   │   ├── infrastructure/
│   │   │   └── assets/    # configs inlined at build time, schemas copied beside the binary
│   │   └── ports/
│   │       └── plugin/    # reading a plugin's distribution, and the translation of it this context takes
│   ├── machine-claims/    # which projects claim a machine-wide plugin or source, and what each user scope holds for them
│   │   ├── application/
│   │   │   └── shared-source/    # the machine's shared framework source and this project's own copy of it
│   │   ├── contract/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── ports/
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
│   │       ├── models/    # the model each provider runs a tier on, and the tier of each agent role
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
│   │   ├── application/    # the host-side rules a command asks: catalogue identity and source conflict, uninstall scope, best-effort calls
│   │   │   └── inspect/    # what a host's registry and a tool's settings say, asked by a check
│   │   ├── contract/
│   │   ├── domain/    # when a catalogue source has drifted from the one recorded
│   │   ├── infrastructure/
│   │   └── ports/
│   ├── telemetry/    # what each billed model call consumed, read from a tool's own transcripts
│   │   ├── application/
│   │   │   ├── declaration/    # declaring a task: what a person typed as the request, and the declaration of it
│   │   │   ├── forget/    # what measurement keeps on a machine, shown and erased
│   │   │   ├── identity/    # who, if anyone, the measurement names
│   │   │   ├── report/    # what the stored calls consumed in a period, along one axis
│   │   │   └── switch/    # opting a repository in or out
│   │   ├── contract/    # what a command and a display read: the periods, the filters, the report, the record, the declaration request
│   │   ├── domain/
│   │   │   ├── consent/    # a clone's identity, and when it consented
│   │   │   ├── declaration/    # the task a person declares, and whether work is bound to one
│   │   │   ├── identity/    # the person a measurement names, and how it is stored
│   │   │   ├── legacy/    # where an earlier version wrote what forget erases, and the table of ids it gave repositories
│   │   │   ├── report/    # attribution of a call, the days of a report, the axes it splits by
│   │   │   └── switch/    # how long Claude Code keeps a transcript, and what that means for opting in
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
│   │   │   └── sink/
│   │   ├── contract/    # the build targets other contexts name
│   │   ├── domain/
│   │   │   └── formats/
│   │   ├── infrastructure/
│   │   └── ports/    # the schema validator a build is handed
│   └── update/    # replacing the installed CLI with its latest release, and the notice that one exists
│       ├── application/
│       ├── domain/
│       ├── infrastructure/
│       └── ports/
├── orchestration/    # the scenarios that chain contexts: one command class per verb, no business rule
│   ├── agent-models/    # recording a provider, rebuilding the agents it changes, then setting the main session
│   ├── clean/    # removing a project's or a machine's installation, then what the hosts and the machine record still hold
│   ├── doctor/    # running every doctor check over the installation
│   ├── global/    # machine-wide runs over every installed tool
│   ├── marketplace/    # holding what is installed against what its marketplaces list
│   ├── plugin/    # the plugin lifecycle, add to remove
│   ├── setup/    # bringing a project from nothing to correct: the scenario, its flow, and the marketplace a setup registers
│   └── sync/    # a sync run in order: settings files, native activation, then what the run recorded
├── shared/    # what two or more contexts need. Imports no context
│   ├── domain/    # the vocabulary: tool identity, source, paths, files, merge strategies, errors
│   │   ├── layout/    # where the framework's built marketplaces sit under `.aidd/` and the user config dir
│   │   ├── materialization/    # where content lands and how its links follow
│   │   ├── plugin/    # a plugin distribution and what a translation skips of it
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
- `src/composition/container.ts` — the composition root. Start here when wiring anything. It caches the graph and calls `src/composition/shared.ts`, `src/composition/installation.ts` and the scenario wire modules in `src/composition/orchestration/`.

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
| a context's wiring | `composition/<context>.ts`, called by `composition/container.ts` |
