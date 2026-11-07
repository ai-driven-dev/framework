# Code map: `src/contexts/telemetry/`

Source of truth: the overview and the telemetry document. Where the telemetry document keeps `domain/ports/`, the overview layout (`ports/` beside `domain/`) wins, so ports move to `contexts/telemetry/ports/`. Command renames drop the `UseCase` suffix; `TelemetryOn`, `TelemetryOff` and `TelemetryStatus` keep the names the telemetry document gives them.

| Current | Target | Action | Note |
| --- | --- | --- | --- |
| `src/contexts/telemetry/domain/branch-binding.ts` | `src/contexts/telemetry/domain/branch-binding.ts` | keep | aggregate |
| `src/contexts/telemetry/domain/repository-identity.ts` | `src/contexts/telemetry/domain/repository-identity.ts` | keep | |
| `src/contexts/telemetry/domain/repository-resolution.ts` | `src/contexts/telemetry/domain/repository-resolution.ts` | keep | |
| `src/contexts/telemetry/domain/stored-usage.ts` | `src/contexts/telemetry/domain/stored-usage.ts` | keep | |
| `src/contexts/telemetry/domain/telemetry-consent.ts` | `src/contexts/telemetry/domain/telemetry-consent.ts` | keep | |
| `src/contexts/telemetry/domain/text-order.ts` | `src/contexts/telemetry/domain/text-order.ts` | keep | |
| `src/contexts/telemetry/domain/transcript-position.ts` | `src/contexts/telemetry/domain/transcript-position.ts` | keep | |
| `src/contexts/telemetry/domain/usage-fold.ts` | `src/contexts/telemetry/domain/usage-fold.ts` | keep | |
| `src/contexts/telemetry/domain/usage-record.ts` | `src/contexts/telemetry/domain/usage-record.ts` | keep | |
| `src/contexts/telemetry/domain/consent/*` | `src/contexts/telemetry/domain/consent/` | keep | consent history and clone identity |
| `src/contexts/telemetry/domain/declaration/*` | `src/contexts/telemetry/domain/declaration/` | keep | task, branch role, binding resolution |
| `src/contexts/telemetry/domain/identity/*` | `src/contexts/telemetry/domain/identity/` | keep | |
| `src/contexts/telemetry/domain/report/*` | `src/contexts/telemetry/domain/report/` | keep | |
| `src/contexts/telemetry/domain/switch/claude-retention.ts` | `src/contexts/telemetry/domain/switch/claude-retention.ts` | keep | proposal: stays in domain; must receive text, not read JSONC itself |
| `src/contexts/telemetry/domain/switch/legacy-config.ts` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
| `src/contexts/telemetry/domain/legacy/*` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
| `src/contexts/telemetry/application/legacy/stored-usage-migration.ts` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
| `src/contexts/telemetry/domain/claude-projects-root.ts` | `src/contexts/telemetry/infrastructure/sources/claude/claude-projects-root.ts` | move | boundary of an external system |
| `src/contexts/telemetry/domain/formats/claude-transcript-usage.ts` | `src/contexts/telemetry/infrastructure/sources/claude/claude-transcript-usage.ts` | move | format decoder joins its source |
| `src/contexts/telemetry/domain/formats/codex-transcript-usage.ts` | `src/contexts/telemetry/infrastructure/sources/codex/codex-transcript-usage.ts` | move | |
| `src/contexts/telemetry/domain/formats/line-values.ts` | `src/contexts/telemetry/infrastructure/sources/line-values.ts` | move | imported by both formats |
| `src/contexts/telemetry/domain/ports/transcript-source.ts` | `src/contexts/telemetry/ports/usage-source.ts` | split | list, read and decode become `UsageSource`; one tool is one adapter |
| `src/contexts/telemetry/domain/ports/bindings/*` | `src/contexts/telemetry/ports/bindings/` | move | ports leave `domain/` |
| `src/contexts/telemetry/domain/ports/forget/*` | `src/contexts/telemetry/ports/forget/` | move | |
| `src/contexts/telemetry/domain/ports/identity/*` | `src/contexts/telemetry/ports/identity/` | move | |
| `src/contexts/telemetry/domain/ports/switch/*` | `src/contexts/telemetry/ports/switch/` | move | settings, config, hook and journal cleaners |
| `src/contexts/telemetry/domain/ports/branch-binding-source.ts` | `src/contexts/telemetry/ports/branch-binding-source.ts` | move | |
| `src/contexts/telemetry/domain/ports/branch-binding-store.ts` | `src/contexts/telemetry/ports/branch-binding-store.ts` | move | |
| `src/contexts/telemetry/domain/ports/consent-history.ts` | `src/contexts/telemetry/ports/consent-history.ts` | move | |
| `src/contexts/telemetry/domain/ports/consent-source.ts` | `src/contexts/telemetry/ports/consent-source.ts` | move | |
| `src/contexts/telemetry/domain/ports/private-storage.ts` | `src/shared/ports/private-storage.ts` | move | the shared technical port, with its adapter in `shared/infrastructure` (runtime code map); replaces the three private-storage implementations |
| `src/contexts/telemetry/domain/ports/repository-alias-store.ts` | `src/contexts/telemetry/ports/repository-alias-store.ts` | move | |
| `src/contexts/telemetry/domain/ports/repository-locator.ts` | `src/contexts/telemetry/ports/repository-locator.ts` | move | |
| `src/contexts/telemetry/domain/ports/resolution-store.ts` | `src/contexts/telemetry/ports/resolution-store.ts` | move | |
| `src/contexts/telemetry/domain/ports/usage-ledger.ts` | `src/contexts/telemetry/ports/usage-ledger.ts` | move | |
| `src/contexts/telemetry/application/branch-declarations.ts` | `src/contexts/telemetry/application/branch-declarations.ts` | keep | helper |
| `src/contexts/telemetry/application/consent-log.ts` | `src/contexts/telemetry/application/consent-log.ts` | keep | helper |
| `src/contexts/telemetry/application/consented-repositories.ts` | `src/contexts/telemetry/application/consented-repositories.ts` | keep | helper |
| `src/contexts/telemetry/application/directory-resolver.ts` | `src/contexts/telemetry/application/directory-resolver.ts` | keep | helper |
| `src/contexts/telemetry/application/ledger-upkeep.ts` | `src/contexts/telemetry/application/ledger-upkeep.ts` | keep | helper |
| `src/contexts/telemetry/application/declare-task-use-case.ts` | `src/contexts/telemetry/application/declare-task.ts` | rename | class `DeclareTask`, 5 dependencies |
| `src/contexts/telemetry/application/ingest-usage-use-case.ts` | `src/contexts/telemetry/application/ingest-usage.ts` | rename | class `IngestUsage`, 6 dependencies: check against the cap |
| `src/contexts/telemetry/application/read-usage-use-case.ts` | `src/contexts/telemetry/application/read-usage.ts` | rename | class `ReadUsage` |
| `src/contexts/telemetry/application/snapshot-bindings-use-case.ts` | `src/contexts/telemetry/application/snapshot-bindings.ts` | rename | class `SnapshotBindings` |
| `src/contexts/telemetry/application/telemetry-status-use-case.ts` | `src/contexts/telemetry/application/telemetry-status.ts` | rename | class `TelemetryStatus`; name kept from the telemetry document |
| `src/contexts/telemetry/application/forget/forget-telemetry-use-case.ts` | `src/contexts/telemetry/application/forget/forget-telemetry.ts` | rename | class `ForgetTelemetry`, 6 dependencies: check against the cap |
| `src/contexts/telemetry/application/identity/manage-identity-use-case.ts` | `src/contexts/telemetry/application/identity/manage-identity.ts` | rename | class `ManageIdentity` |
| `src/contexts/telemetry/application/identity/propose-identity-use-case.ts` | `src/contexts/telemetry/application/identity/propose-identity.ts` | rename | class `ProposeIdentity` |
| `src/contexts/telemetry/application/report/report-usage-use-case.ts` | `src/contexts/telemetry/application/report/report-usage.ts` | rename | class `ReportUsage`, 6 dependencies: check against the cap |
| `src/contexts/telemetry/application/report/declared-bindings.ts` | `src/contexts/telemetry/application/report/declared-bindings.ts` | keep | helper |
| `src/contexts/telemetry/application/report/report-envelope.ts` | `src/contexts/telemetry/application/report/report-envelope.ts` | keep | helper |
| `src/contexts/telemetry/application/switch/telemetry-off-use-case.ts` | `src/contexts/telemetry/application/switch/telemetry-off.ts` | rename | class `TelemetryOff`, 6 dependencies: check against the cap |
| `src/contexts/telemetry/application/switch/telemetry-on-use-case.ts` | `src/contexts/telemetry/application/switch/telemetry-on.ts`; `src/contexts/telemetry/application/switch/read-claude-retention.ts` | split | 13 dependencies; each command at most 5; proposal: names of the two new commands |
| `src/contexts/telemetry/application/switch/clone-consent.ts` | `src/contexts/telemetry/application/switch/clone-consent.ts` | keep | helper |
| `src/contexts/telemetry/application/switch/remember-own-root.ts` | `src/contexts/telemetry/application/switch/remember-own-root.ts` | keep | helper |
| `src/contexts/telemetry/infrastructure/run-git.ts` | `src/contexts/telemetry/infrastructure/git/run-git.ts` | move | single git executor |
| `src/contexts/telemetry/infrastructure/git-branch-binding-source-adapter.ts` | `src/contexts/telemetry/infrastructure/git/git-branch-binding-source-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/git-consent-adapter.ts` | `src/contexts/telemetry/infrastructure/git/git-consent-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/git-repository-locator-adapter.ts` | `src/contexts/telemetry/infrastructure/git/git-repository-locator-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/declaration/git-branch-binding-store-adapter.ts` | `src/contexts/telemetry/infrastructure/git/git-branch-binding-store-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/identity/git-user-source-adapter.ts` | `src/contexts/telemetry/infrastructure/git/git-user-source-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/binding-snapshot-store-adapter.ts` | `src/contexts/telemetry/infrastructure/storage/binding-snapshot-store-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/bindings-lock-adapter.ts` | `src/contexts/telemetry/infrastructure/storage/bindings-lock-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/ledger-lock.ts` | `src/contexts/telemetry/infrastructure/storage/ledger-lock.ts` | move | |
| `src/contexts/telemetry/infrastructure/resolution-store-adapter.ts` | `src/contexts/telemetry/infrastructure/storage/resolution-store-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/usage-ledger-adapter.ts` | `src/contexts/telemetry/infrastructure/storage/usage-ledger-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/left-out/left-out-adapter.ts` | `src/contexts/telemetry/infrastructure/storage/left-out-adapter.ts` | move | proposal: single-file folder flattened into storage |
| `src/contexts/telemetry/infrastructure/consent/clone-identity-reader.ts` | `src/contexts/telemetry/infrastructure/storage/clone-identity-reader.ts` | move | proposal: reads file-system identity, not git |
| `src/contexts/telemetry/infrastructure/consent/consent-history-adapter.ts` | `src/contexts/telemetry/infrastructure/storage/consent-history-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/declaration/session-binding-store-adapter.ts` | `src/contexts/telemetry/infrastructure/storage/session-binding-store-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/forget/*` | `src/contexts/telemetry/infrastructure/storage/` | move | measurement erasure and repository declarations |
| `src/contexts/telemetry/infrastructure/identity/person-identity-adapter.ts` | `src/contexts/telemetry/infrastructure/storage/person-identity-adapter.ts` | move | |
| `src/contexts/telemetry/infrastructure/claude-transcript-source-adapter.ts` | `src/contexts/telemetry/infrastructure/sources/claude/claude-usage-source.ts` | rename | proposal: becomes the single `UsageSource` adapter for Claude Code (list, read, decode) |
| `src/contexts/telemetry/infrastructure/transcripts/codex-transcript-source-adapter.ts` | `src/contexts/telemetry/infrastructure/sources/codex/codex-usage-source.ts` | rename | proposal: single `UsageSource` adapter for Codex |
| `src/contexts/telemetry/infrastructure/transcripts/transcript-files.ts` | `src/contexts/telemetry/infrastructure/sources/claude/transcript-files.ts` | move | Claude journal files, per the telemetry document |
| `src/contexts/telemetry/infrastructure/transcripts/zstd-frame.ts` | `src/contexts/telemetry/infrastructure/sources/codex/zstd-frame.ts` | move | |
| `src/contexts/telemetry/infrastructure/switch/claude-settings-adapter.ts` | `src/contexts/telemetry/infrastructure/sources/claude/claude-settings-adapter.ts` | move | proposal: stays in telemetry (read-only retention read), keeping it autonomous |
| `src/contexts/telemetry/infrastructure/switch/legacy-hook-adapter.ts` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
| `src/contexts/telemetry/infrastructure/switch/project-config-adapter.ts` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15; delete only if the earlier-block cleanup is its only use, checked in that PR |
| `src/contexts/telemetry/infrastructure/switch/run-journal-adapter.ts` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
| `src/contexts/telemetry/infrastructure/legacy/repository-alias-store-adapter.ts` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
