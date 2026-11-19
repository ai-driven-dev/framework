# `telemetry` context: target shape (reference)

Reconciled with `00-overview.md`, which wins on any disagreement.

## Purpose and boundary

`telemetry` counts what an AI session consumed, attributes it to a task the person declared, and returns it as a report. The product-side contract is in `aidd_docs/product/usage-contract.md`; this document does not repeat it.

What makes it the reference context, measured on the current code:

| Property | Finding |
| --- | --- |
| Imports outside the context | only `kernel` (becomes `shared`): 5 modules (`reading/text-file`, `reading/json-file`, `reading/plain-object`, `reading/jsonc`, `paths`), all pure reading |
| No import of a neighbouring context | yes, including in the tests of `tests/contexts/telemetry` |
| Pure domain | `domain/` touches only ports and computation; the 27 files of `infrastructure/` are the only ones reading disk, git and logs |
| Adapters built elsewhere | `runtime/wiring/telemetry.ts` (220 lines) is the only wiring root (becomes `composition/telemetry.ts`) |
| Doubles | 15 in-memory fakes in `tests/helpers/ports/in-memory-telemetry.ts` (431 lines), one per port |

Boundary: the context never reads or writes application code. It writes only its own private storage (registry, bindings, consent) and cleans up what the former measurement left behind.

`telemetry` stays the reference autonomous context: in the context map it has no supplier and no customer among the contexts.

## Ubiquitous language

| Term | Meaning | Sub-area |
| --- | --- | --- |
| Consent | a repository clone's agreement to be measured, with its history | `domain/consent/`, `telemetry-consent.ts` |
| Identity | who, if anyone, the measurement names (`person-identity`) | `domain/identity/` |
| Clone | a working directory of a repository; its key is used for consent | `consent/clone-identity.ts` |
| Repository (identity) | stable fingerprint of the repository, derived from the remote address | `repository-identity.ts`, `repository-resolution.ts` |
| Billed call / usage record | one model call counted once; `(tool, key)` is stable | `usage-record.ts`, `usage-fold.ts` |
| Stored usage | a usage record plus the repository identifier resolved at ingestion | `stored-usage.ts` |
| Ledger | per-UTC-day storage of stored usages | port `usage-ledger.ts` |
| Task | what the person declares working on (name, ticket) | `declaration/task-declaration.ts` |
| Binding | link between a branch or a session and a task | `branch-binding.ts`, `declaration/binding-resolution.ts` |
| Branch role | a branch's place in the declaration | `declaration/branch-role.ts` |
| Transcript position | how far a file has been read | `transcript-position.ts` |
| Report | period, axes, filters, attribution, JSON envelope | `domain/report/`, `application/report/` |
| Earlier measurement | what an earlier version of the measurement left behind (config block, commit hook, journal, aliases); cleaned by switching, or upgraded in storage | `domain/legacy/`, `domain/switch/legacy-config.ts` today; `switch/` and `storage/` at the target |

## Model (invariants and current source)

| Aggregate | Invariants | Current source |
| --- | --- | --- |
| Stored usage | a call is counted once; several snapshots of the same call fold onto the largest; an unknown value is `null`, never `0`; the partition day is in UTC and requires an explicit time zone | `domain/stored-usage.ts` (`dayOf`, `daysAround`), `domain/usage-fold.ts`, `domain/usage-record.ts` |
| Branch binding | only the command declares; the `aiddDeclaredAt` key, written last, proves a complete declaration; a snapshot keeps the task of a deleted or renamed branch | `domain/branch-binding.ts` |
| Repository identity | normalized address (host and path, no credentials or port), then hashed; no owner/repo, no identity | `domain/repository-identity.ts`, `domain/repository-resolution.ts` |
| Consent | a measured clone is a granted clone, by the environment or by the history | `domain/telemetry-consent.ts`, `domain/consent/consent-history.ts` |
| Read position | a read resumes where the previous one ended; a file that shrank is not counted | `domain/transcript-position.ts`, port `transcript-source.ts:23` |

As the overview requires, invariants live in the aggregate (constructor or factory), not in the commands: a command orchestrates, the aggregate decides.

## Domain services

Pure, stateless functions: usage fold (`usage-fold.ts`), per-tool line format (`formats/claude-transcript-usage.ts`, `formats/codex-transcript-usage.ts`), binding resolution (`declaration/binding-resolution.ts`), attribution (`report/attribution.ts`), filter and period (`report/report-filter.ts`, `report/period.ts`), legacy config cleanup (`switch/legacy-config.ts`). These are what the `.property` tests cover.

## Commands owned

A use case is a command, as defined in the overview: one file in kebab-case, one class of the same name, a single public `execute(command)`, private sub-functions, no `UseCase` suffix. Each command has its own `<Name>Command` and `<Name>Result`. The renaming happens in the PR that renames use cases, context by context.

11 use cases today, grouped by sub-area, shown with their current names. The numbers in parentheses are injected dependencies, read from `tests/architecture/orchestrator-deps.arch.test.ts`.

| Sub-area | Use case (target command name) |
| --- | --- |
| Consent | `TelemetryOnUseCase` (13), `TelemetryOffUseCase` (6), `ForgetTelemetryUseCase` (6) |
| Identity | `ManageIdentityUseCase`, `ProposeIdentityUseCase` |
| Declaration | `DeclareTaskUseCase` (5), `SnapshotBindingsUseCase`, `TelemetryStatusUseCase` (5) |
| Ingestion | `IngestUsageUseCase` (6), `ReadUsageUseCase` (one per tool) |
| Report | `ReportUsageUseCase` (6) |
| Migration | `StoredUsageMigration` |

Target names drop the suffix: `TelemetryOn`, `TelemetryOff`, `ForgetTelemetry`, `ManageIdentity`, `ProposeIdentity`, `DeclareTask`, `SnapshotBindings`, `TelemetryStatus`, `IngestUsage`, `ReadUsage`, `ReportUsage`.

Three of these names are not verb first (`TelemetryOn`, `TelemetryOff`, `TelemetryStatus`), against the overview's naming by intent. They are renamed in the renaming PR. Proposal: `EnableTelemetry`, `DisableTelemetry`, `ReadTelemetryStatus`.

The overview caps a command at 5 constructor dependencies, checked by a deterministic architecture test. `TelemetryOnUseCase` at 13 dependencies is the one that must be split: enabling, cleaning up the legacy and reading retention are three reasons to change. It becomes three commands, as in the code map: `TelemetryOn` (enabling), and, as proposals, `CleanLegacyMeasurement` and `ReadClaudeRetention`. Four others sit at 6 (`TelemetryOff`, `ForgetTelemetry`, `IngestUsage`, `ReportUsage`), one above the cap: each needs checking against the cap when the rule lands, and is not assumed to split.

## Ports (owner, consumers)

Owner: `telemetry`. Consumers: its own commands only. 22 port files, in `domain/ports/` today; at the target in `ports/`, beside `domain/` (overview layout).

| Port | Role | External system behind it |
| --- | --- | --- |
| `TranscriptSource` | list, date, read the lines of a tool's journal | Claude Code and Codex session journals |
| `UsageLedger`, `ResolutionStore`, `BindingSnapshotStore`, `SessionBindingStore`, `PersonIdentityStore`, `ConsentHistory`, `RepositoryAliasStore` | the context's own state | `PrivateStorage` (disk, owner permissions) |
| `RepositoryLocator`, `BranchBindingSource`, `BranchBindingStore`, `ConsentSource`, `GitUserSource` | git facts | local git |
| `BindingsLock`, ledger lock | cross-process exclusion | file system |
| `ClaudeSettingsSource` | read `cleanupPeriodDays` | Claude Code settings (read-only) |
| `LegacyHookCleaner`, `ProjectConfigFile`, `RunJournalCleaner`, `MeasurementErasure` | legacy cleanup and erasure | git hooks, project config, former journal |

`telemetry` keeps its per-tool readers behind its own ports. Target: `TranscriptSource` becomes `UsageSource` (one tool = one adapter that reads AND decodes: `list`, `read`, `decode(line)`), registered once in `composition/`. Today a tool is added in two places: the file adapter and the format reader, assembled by hand in `wiring/telemetry.ts:146-158`.

## Adapters and external systems (who owns each)

| External system | Owned by | Adapters |
| --- | --- | --- |
| Claude Code journals (`projects`, `.jsonl`, `.superseded-*`) | `telemetry` | `claude-transcript-source-adapter.ts`, `transcripts/transcript-files.ts` |
| Codex journals (sessions, jsonl/zstd) | `telemetry` | `transcripts/codex-transcript-source-adapter.ts`, `transcripts/zstd-frame.ts` |
| git (remote, branch config, reflog, user) | `telemetry` for its uses; a single executor | `run-git.ts` and six `git-*` adapters |
| Private storage, locks | `telemetry` | `usage-ledger-adapter.ts`, `ledger-lock.ts`, `bindings-lock-adapter.ts` |
| File readable by its owner only | `shared` (a technology with no business meaning, used by `auth`, `telemetry`, `distribution`) | `private-storage-adapter.ts`, in `shared/infrastructure` |
| Claude Code settings | `host-registration` | `switch/claude-settings-adapter.ts` |
| Legacy commit hook (lefthook, husky, `prepare-commit-msg`) | `telemetry` (state left by its former version) | `switch/legacy-hook-adapter.ts` |
| Project config `.aidd/config.json` | to be decided (see questions) | `switch/project-config-adapter.ts` |

Correction to the starting hypothesis: `ClaudeSettingsAdapter` is read-only (`claude-settings-adapter.ts`, class comment) and serves only transcript retention (`domain/switch/claude-retention.ts`). The legacy hook is a git hook of the repository, not an AI tool hook. The overlap with `host-registration` is therefore a settings read, not a host configuration write.

## Dependencies

Target: `telemetry` imports `shared/domain` and `shared/ports` only. Cross-context imports go only through `application/` and `contract/`; `telemetry` consumes none, and `shared/infrastructure` is imported only by `composition`. The five `kernel` modules it consumes are file and JSON reading utilities; they enter `shared` only if at least two contexts import them (computed by the rule), otherwise they go down into `telemetry/domain/` or `infrastructure/`. Today they mostly serve adapters and JSON parsing in the domain: settings parsing (`claude-retention.ts`, `legacy-config.ts`) is domain code reading JSONC, to be kept pure by receiving text.

No context imports `telemetry`: this is expressed by the allowed-edges table, where `telemetry` is autonomous. Today the only exit points are the wiring root and `presentation` (24 imports, 4 files, see below) plus `runtime/filesystem/private-storage-adapter.ts` (adapter of the `PrivateStorage` port, its only user today). It moves into `shared/infrastructure/`, not into the telemetry infrastructure: `auth` and `distribution` also need a file readable by its owner only, and one shared adapter replaces their own implementations. After the move, `presentation` imports only `application/`.

## Tests (levels, contracts, what a test must provide)

Existing: 78 files, 16.8k lines; setup-to-assertion ratio about 1.0, the best in the repository. The mutation floor is 96, with the largest floor-to-score gap of all scopes (about 11 points on average in failing runs).

Mutation: `telemetry` is one of only two scopes (with `shared`) that keep a per-PR mutation gate; every other scope moves to the weekly cron. Its floor is set at the target (not frozen like the others during the transition).

Conventions from the overview: one test file per command, keeping its level suffix (`declare-task.unit.test.ts`), titles in English (`describe` names a situation, `it` an observable result), one test kit per context (the in-memory fakes and builders), never importing another context's kit.

| Level | Content | Must provide |
| --- | --- | --- |
| Domain, `.unit` and `.property` | fold, UTC day, resolution, attribution, filters, line formats | nothing: pure functions |
| Application, `.unit` | commands with in-memory fakes | port fakes, drawn from a single module |
| Application, `.property.integration` | streaming ingestion, ledger, migration, report | fakes plus input generators |
| Port contract | each fake and each adapter pass the same suite | fake and real adapter, same contract file |
| Infrastructure, `.integration` | adapters on a temporary disk or temporary git repository | sandbox (`telemetry-sandbox.ts`) |
| E2E | built binary, `telemetry-ingest.e2e.test.ts` | journal fixtures |

Main gap: the 15 fakes are not tied to their adapters by a common contract suite; nothing proves a fake behaves like the real lock or the real ledger. To create: one contract suite per stateful port (`UsageLedger`, `BindingSnapshotStore`, `ConsentHistory`, `BindingsLock`), run against the fake and against the adapter.

Contracts at the external boundaries, real journal formats:

| Boundary | Today | Target |
| --- | --- | --- |
| Claude Code journal | 4 fixtures (`tests/fixtures/claude-usage/projects`) | one real, anonymized record per observed tool version, labelled by version and not by date; each version replays the decoder and checks the expected counters |
| Codex journal | synthetic input only | same real records, in jsonl and in zstd |
| Drift detection | none | a shape test: any line of a real fixture journal whose type is not recognized is listed in `unrecognised` and fails the contract until the line is classified (counted or explicitly ignored) |
| git | adapters tested on a temporary repository | unchanged |

The drift test cannot run on the developer machine's journals (no model call, no private data): it runs on the recorded fixtures. Recording a new version is an explicit manual action.

## Rules a tool can enforce (rule, mechanism, replaces which current guard)

Properties for the other contexts to copy, and the state of their verification:

| Property | Verified today? | Target mechanism | Replaces |
| --- | --- | --- | --- |
| Only `shared` is imported (plus `application/` and `contract/` of other contexts, per the allowed-edges table) | partially: `context-graph.arch.test.ts` reads a baselined graph, the `kernel` chain is tolerated | the overview's import rules, checked by the lint tool (folder boundaries); an edge absent from the table is an error | `context-graph.arch.test.ts` and its baselines, `framework`/`translate` sections of `biome.json` |
| Domain without application or infrastructure | not for `telemetry`: `biome.json` carries these rules for `framework` and `translate`, and cites `telemetry` only to forbid it to others; the purity of the telemetry domain rests on discipline | same rule generated for all contexts | per-context blocks of `biome.json` |
| Application without infrastructure | not for `telemetry`, same finding | same | same |
| Declared public surface | yes, manual list `PUBLIC_MODULES.telemetry` (28 files) in `context-boundary.arch.test.ts` | removed: a context exposes only `application/` and `contract/`; after the wiring root moves, `presentation` talks only to commands; `presentation` imports only `application/` | `context-boundary.arch.test.ts` for this context |
| Narrow ports | no: `orchestrator-deps` caps injected dependencies (13 for `TelemetryOnUseCase`) | cap of 5 constructor dependencies per command, by deterministic architecture test or lint rule | `orchestrator-deps.arch.test.ts` |
| Port called | yes, `ports-are-called.arch.test.ts` (rough grep) | `knip` for the unused export; keep this test only if it still catches drift | to be reassessed |
| A tool named in one place only | yes, `tool-addition-cost.arch.test.ts` lists 5 telemetry files | the single registration in `composition/` makes the list unnecessary | telemetry entries of the list |
| Pure domain tested with `.property` | no, convention only | no reliable mechanical rule; checked by review and by mutation | none |
| Fakes with a contract | no | shared contract suite (above) | none |
| No `process.exit` outside root presentation | yes, `biome-plugins/no-process-exit.grit` | unchanged | (existing tool) |

## Current-to-target mapping

Folder level. Source: `cli/src/contexts/telemetry/`.

| Current path | Action | Target |
| --- | --- | --- |
| `domain/` (except `ports/`, `formats/`, `legacy/`, `switch/legacy-config.ts`, `claude-projects-root.ts`) | keep | `contexts/telemetry/domain/`; `switch/claude-retention.ts` stays (proposal: it receives text instead of reading JSONC) |
| `domain/ports/*` (22 files) | move | `contexts/telemetry/ports/`, beside `domain/` |
| `domain/formats/claude-transcript-usage.ts`, `domain/claude-projects-root.ts` | move | `contexts/telemetry/infrastructure/sources/claude/` (the format is the boundary of an external system) |
| `domain/formats/codex-transcript-usage.ts`, `line-values.ts` | move | `contexts/telemetry/infrastructure/sources/codex/`; `line-values.ts`, imported by both formats, goes into the common `sources/` |
| `domain/ports/transcript-source.ts` | split | `UsageSource` (list, read, decode) in `ports/usage-source.ts` |
| `application/*.ts`, `report/`, `identity/`, `forget/` | keep, rename | same folders; each `*-use-case.ts` becomes a command (kebab-case file, class of the same name, no `UseCase` suffix, public `execute(command)`), in the renaming PR |
| `application/switch/telemetry-on-use-case.ts` (175 lines, 13 dependencies) | split | `application/switch/telemetry-on.ts`, `clean-legacy-measurement.ts`, `read-claude-retention.ts` (proposal: names of the two new commands): each a command of at most 5 dependencies |
| `application/legacy/stored-usage-migration.ts`, `domain/legacy/*`, `domain/switch/legacy-config.ts`, `infrastructure/legacy/*`, `infrastructure/switch/{legacy-hook,run-journal}-adapter.ts` | delete | Legacy support is deleted (decided, overview section 15): about 470 lines. Its own PR, before `telemetry` moves, with the preconditions written in the overview (earlier commit hook characterized, effect on records stored under earlier rules stated, release note). `TelemetryOn` loses its cleanup steps, which also removes most of its 13 dependencies. |
| `infrastructure/` | keep, reorganize by external system | `infrastructure/{git,storage,sources,legacy}/` |
| `infrastructure/switch/claude-settings-adapter.ts` | move | `infrastructure/sources/claude/` (proposal: stays in `telemetry`, a read-only retention read, which keeps it autonomous in the map); `contexts/host-registration/` only if open question 1 is decided that way |
| `runtime/wiring/telemetry.ts` (220 lines) | move | `composition/telemetry.ts` (`runtime` is dissolved into `composition` and `shared`) |
| `runtime/filesystem/private-storage-adapter.ts` | move | `shared/infrastructure/private-storage-adapter.ts` (used by `auth`, `telemetry`, `distribution`) |
| `presentation/commands/telemetry.ts` (378 lines, 33 branches, 4 `process.exit`) | split | thin command; validation and identity-choice decisions (`IdentityChoice`, requested filters) move down into the commands |
| `presentation/display/telemetry*` | keep | `presentation/` |
| `kernel/reading/*`, `kernel/paths.js` (consumed) | move or keep | `shared/` if two contexts import it (computed), otherwise inside the context |

Files to move or split named above: 4 format moves, 1 port split, 1 use case split, 1 command split, 2 root and storage moves, plus the renaming of every use case to a command.

## Open questions and assumptions about neighbours

Decisions to make:

1. Owner of the `cleanupPeriodDays` read: `host-registration` (host setting) or `telemetry` (read-only use). Recommendation: `telemetry` keeps a narrow read port, `host-registration` owns only the write.
2. Owner of the `.aidd/config.json` file: decided. It is a co-owned project file; `telemetry` keeps an adapter that only removes the block an earlier telemetry version wrote, under the existing co-owned merge regime. No ownership move.
3. The per-tool readers stay in `telemetry` (hypothesis validated by the brief, and consistent with the overview), but the tool name `claude-code`/`codex` is a `tools` vocabulary; keeping a local copy in `usage-record.ts` avoids the import, at the price of possible drift. The context map has `telemetry` autonomous, so no edge to `tools` is available.

Assumptions about neighbours: `shared` provides file and JSON reading; `composition/` may import `telemetry` with no reverse edge; `presentation` imports only commands (`application/`); no `orchestration/` scenario is assumed to coordinate `telemetry` with another context (not verified).

Unverified: the command's branch counts (33) are taken as provided; the number of runs configured for the telemetry property tests (also listed as unverified in the overview).
