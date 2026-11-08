# Code map: telemetry tests, presentation, e2e, helpers, architecture, golden, scripts, fixtures

| Current | Target | Action | Note |
| --- | --- | --- | --- |
| `tests/contexts/telemetry/domain/claude-projects-root.unit.test.ts` | `tests/contexts/telemetry/infrastructure/sources/claude/claude-projects-root.unit.test.ts` | move | format code moves to the Claude source adapter folder (06 mapping) |
| `tests/contexts/telemetry/domain/formats/claude-transcript-usage.unit.test.ts` | `tests/contexts/telemetry/infrastructure/sources/claude/claude-transcript-usage.unit.test.ts` | move | the journal format is the boundary of an external system |
| `tests/contexts/telemetry/domain/formats/codex-transcript-usage.unit.test.ts` | `tests/contexts/telemetry/infrastructure/sources/codex/codex-transcript-usage.unit.test.ts` | move | same, Codex side |
| `tests/contexts/telemetry/domain/binding-resolution.unit.test.ts` | `tests/contexts/telemetry/domain/declaration/binding-resolution.unit.test.ts` | move | mirror the source folder |
| `tests/contexts/telemetry/domain/branch-role.unit.test.ts` | `tests/contexts/telemetry/domain/declaration/branch-role.unit.test.ts` | move | mirror the source folder |
| `tests/contexts/telemetry/domain/task-declaration.unit.test.ts` | `tests/contexts/telemetry/domain/declaration/task-declaration.unit.test.ts` | move | mirror the source folder |
| `tests/contexts/telemetry/domain/clone-identity.unit.test.ts` | `tests/contexts/telemetry/domain/consent/clone-identity.unit.test.ts` | move | mirror the source folder |
| `tests/contexts/telemetry/domain/consent-history.unit.test.ts` | `tests/contexts/telemetry/domain/consent/consent-history.unit.test.ts` | move | mirror the source folder |
| `tests/contexts/telemetry/domain/legacy/*` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
| `tests/contexts/telemetry/domain/switch/legacy-config.unit.test.ts` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
| `tests/contexts/telemetry/domain/*` | `tests/contexts/telemetry/domain/*` | keep | pure domain tests stay; `.property` cases stay with their module |
| `tests/contexts/telemetry/application/declare-task-use-case.unit.test.ts` | `tests/contexts/telemetry/application/declare-task.unit.test.ts` | rename | one test file per command, named like it |
| `tests/contexts/telemetry/application/forget/forget-telemetry-use-case.unit.test.ts` | `tests/contexts/telemetry/application/forget/forget-telemetry.unit.test.ts` | rename | command rename |
| `tests/contexts/telemetry/application/identity/manage-identity-use-case.unit.test.ts` | `tests/contexts/telemetry/application/identity/manage-identity.unit.test.ts` | rename | command rename |
| `tests/contexts/telemetry/application/identity/propose-identity-use-case.unit.test.ts` | `tests/contexts/telemetry/application/identity/propose-identity.unit.test.ts` | rename | command rename |
| `tests/contexts/telemetry/application/ingest-usage-use-case.unit.test.ts` | `tests/contexts/telemetry/application/ingest-usage.unit.test.ts` | rename | command rename; 6 dependencies to check against the cap |
| `tests/contexts/telemetry/application/read-usage-use-case.integration.test.ts` | `tests/contexts/telemetry/application/read-usage.integration.test.ts` | rename | command rename; it reads real journal fixtures so it stays integration |
| `tests/contexts/telemetry/application/report/report-usage-use-case.unit.test.ts` | `tests/contexts/telemetry/application/report/report-usage.unit.test.ts` | rename | command rename |
| `tests/contexts/telemetry/application/snapshot-bindings-use-case.unit.test.ts` | `tests/contexts/telemetry/application/snapshot-bindings.unit.test.ts` | rename | command rename |
| `tests/contexts/telemetry/application/telemetry-status-use-case.unit.test.ts` | `tests/contexts/telemetry/application/telemetry-status.unit.test.ts` | rename | command rename |
| `tests/contexts/telemetry/application/switch/telemetry-switch-use-cases.unit.test.ts` | `tests/contexts/telemetry/application/switch/telemetry-on.unit.test.ts`; `tests/contexts/telemetry/application/switch/telemetry-off.unit.test.ts`; `tests/contexts/telemetry/application/switch/cleanup-legacy-measurement.unit.test.ts`; `tests/contexts/telemetry/application/switch/read-transcript-retention.unit.test.ts` | split | proposal: one file per command; TelemetryOn (13 dependencies) splits into enabling, legacy cleanup and retention read (06) |
| `tests/contexts/telemetry/application/legacy/stored-usage-migration.property.integration.test.ts` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
| `tests/contexts/telemetry/application/*` | `tests/contexts/telemetry/application/*` | keep | ledger, ingestion and report property tests stay; the property run count is still unverified |
| `tests/contexts/telemetry/consent-scenarios.integration.test.ts` | `tests/contexts/telemetry/consent-scenarios.integration.test.ts` | keep | proposal: multi-layer scenario kept at the context root |
| `tests/contexts/telemetry/telemetry-lifecycle.integration.test.ts` | `tests/contexts/telemetry/telemetry-lifecycle.integration.test.ts` | keep | proposal: multi-layer scenario kept at the context root |
| `tests/contexts/telemetry/telemetry-bindings-fixture.unit.test.ts` | `tests/contexts/telemetry/telemetry-bindings-fixture.unit.test.ts` | keep | proposal: reads a fixture across several domain modules, no single mirror path |
| `tests/contexts/telemetry/infrastructure/git-branch-binding-source-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/git/git-branch-binding-source-adapter.integration.test.ts` | move | git adapters group by external system (06) |
| `tests/contexts/telemetry/infrastructure/git-branch-binding-store-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/git/git-branch-binding-store-adapter.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/git-consent-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/git/git-consent-adapter.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/git-repository-locator-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/git/git-repository-locator-adapter.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/identity/git-user-source-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/git/git-user-source-adapter.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/run-git.integration.test.ts` | `tests/contexts/telemetry/infrastructure/git/run-git.integration.test.ts` | move | single git executor |
| `tests/contexts/telemetry/infrastructure/clone-identity-reader.integration.test.ts` | `tests/contexts/telemetry/infrastructure/git/clone-identity-reader.integration.test.ts` | move | proposal: clone key is read from the repository working directory |
| `tests/contexts/telemetry/infrastructure/binding-snapshot-store-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/storage/binding-snapshot-store-adapter.integration.test.ts` | move | private storage adapters group together (06) |
| `tests/contexts/telemetry/infrastructure/bindings-lock-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/storage/bindings-lock-adapter.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/ledger-lock.integration.test.ts` | `tests/contexts/telemetry/infrastructure/storage/ledger-lock.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/usage-ledger-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/storage/usage-ledger-adapter.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/session-binding-store-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/storage/session-binding-store-adapter.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/resolution-and-consent-adapters.integration.test.ts` | `tests/contexts/telemetry/infrastructure/storage/resolution-and-consent-adapters.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/stored-ids-and-keys.integration.test.ts` | `tests/contexts/telemetry/infrastructure/storage/stored-ids-and-keys.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/identity/person-identity-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/storage/person-identity-adapter.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/forget/measurement-erasure-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/storage/measurement-erasure-adapter.integration.test.ts` | move | proposal: erasure acts on private storage |
| `tests/contexts/telemetry/infrastructure/forget/repository-declarations-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/storage/repository-declarations-adapter.integration.test.ts` | move | proposal: reads declarations kept in private storage |
| `tests/contexts/telemetry/infrastructure/claude-transcript-source-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/sources/claude/claude-transcript-source-adapter.integration.test.ts` | move | session journal adapters group under sources (06) |
| `tests/contexts/telemetry/infrastructure/transcripts/codex-transcript-source-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/sources/codex/codex-transcript-source-adapter.integration.test.ts` | move | same |
| `tests/contexts/telemetry/infrastructure/transcripts/zstd-frame.unit.test.ts` | `tests/contexts/telemetry/infrastructure/sources/codex/zstd-frame.unit.test.ts` | move | zstd framing is Codex-only |
| `tests/contexts/telemetry/infrastructure/transcript-stream.property.integration.test.ts` | `tests/contexts/telemetry/infrastructure/sources/transcript-stream.property.integration.test.ts` | move | stream reading shared by both sources |
| `tests/contexts/telemetry/infrastructure/switch/legacy-hook-adapter.integration.test.ts` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
| `tests/contexts/telemetry/infrastructure/switch/run-journal-adapter.integration.test.ts` | - | delete | deleted: support for what an earlier telemetry version left (decided); separate PR with its own preconditions, overview section 15 |
| `tests/contexts/telemetry/infrastructure/switch/claude-settings-adapter.integration.test.ts` | `tests/contexts/telemetry/infrastructure/switch/claude-settings-adapter.integration.test.ts` | keep | proposal: stays while the owner of the cleanup period read is open (06 question 1); telemetry stays autonomous |
| `tests/helpers/ports/in-memory-telemetry.ts` | `tests/contexts/telemetry/testing/in-memory-usage-ledger.ts`; `tests/contexts/telemetry/testing/in-memory-transcripts.ts`; `tests/contexts/telemetry/testing/in-memory-left-out.ts`; `tests/contexts/telemetry/testing/in-memory-bindings-lock.ts`; `tests/contexts/telemetry/testing/in-memory-consent-history.ts`; `tests/contexts/telemetry/testing/in-memory-resolutions.ts`; `tests/contexts/telemetry/testing/in-memory-binding-snapshots.ts`; `tests/contexts/telemetry/testing/in-memory-session-bindings.ts`; `tests/contexts/telemetry/testing/in-memory-identity.ts`; `tests/contexts/telemetry/testing/fake-git-sources.ts`; `tests/contexts/telemetry/testing/builders.ts` | split | proposal: the 15 doubles become one file per port plus builders and constants, no catch-all file (07 section 2.3) |
| `tests/helpers/ports/failing-private-storage.ts` | `tests/contexts/telemetry/testing/failing-private-storage.ts` | move | telemetry private storage double |
| `tests/helpers/telemetry-sandbox.ts` | `tests/contexts/telemetry/testing/telemetry-sandbox.ts` | move | sandbox of the telemetry infrastructure tests |
| `tests/helpers/telemetry-sandbox.integration.test.ts` | `tests/contexts/telemetry/testing/telemetry-sandbox.integration.test.ts` | move | tests of the kit travel with it |
| `tests/helpers/git-sandbox.ts` | `tests/contexts/telemetry/testing/git-sandbox.ts` | move | proposal: 11 of its importers are telemetry tests; the telemetry e2e files import it from the kit, since e2e is not a context test |
| `tests/helpers/whole-transcript-reader.ts` | `tests/contexts/telemetry/testing/whole-transcript-reader.ts` | move | oracle for the stream reading, telemetry only |
| - | `tests/contexts/telemetry/testing/run-usage-ledger-contract.ts`; `tests/contexts/telemetry/domain/ports/usage-ledger.contract.test.ts` | add | contract suite for the ledger, run on the fake and the real adapter (06 gap, 07 section 2.3) |
| - | `tests/contexts/telemetry/testing/run-binding-snapshot-store-contract.ts`; `tests/contexts/telemetry/domain/ports/binding-snapshot-store.contract.test.ts` | add | contract suite for the snapshot store |
| - | `tests/contexts/telemetry/testing/run-consent-history-contract.ts`; `tests/contexts/telemetry/domain/ports/consent-history.contract.test.ts` | add | contract suite for the consent history |
| - | `tests/contexts/telemetry/testing/run-bindings-lock-contract.ts`; `tests/contexts/telemetry/domain/ports/bindings-lock.contract.test.ts` | add | contract suite for the cross-process lock |
| - | `tests/contexts/telemetry/testing/run-usage-source-contract.ts`; `tests/contexts/telemetry/domain/ports/usage-source.contract.test.ts` | add | proposal: session log reader replayed on recorded real journals; drift shape test lists unrecognised lines (06) |
| `tests/presentation/commands/*` | `tests/presentation/commands/*` | keep | thin command tests; rewrite wiring ones against fake scenarios, no production wiring mock (03) |
| `tests/presentation/display/*` | `tests/presentation/display/*` | keep | one display file per command, no logic |
| `tests/presentation/error-handler.unit.test.ts` | `tests/presentation/errors/error-handler.unit.test.ts` | move | translator and message table move to presentation/errors (03) |
| `tests/presentation/logger-adapter.integration.test.ts` | `tests/presentation/terminal/logger-adapter.integration.test.ts` | move | CLIOutput as Logger lives in presentation/terminal (03) |
| `tests/presentation/verbose.unit.test.ts` | `tests/presentation/terminal/verbose.unit.test.ts` | move | tests CLIOutput verbosity, terminal side |
| `tests/presentation/prompts/interactive-menu-use-case.unit.test.ts` | `tests/orchestration/menu/interactive-menu.unit.test.ts` | move | menu tree and argv production move to orchestration/menu (03 section 4.4) |
| `tests/presentation/prompts/plugin-pick-use-case.unit.test.ts` | `tests/contexts/distribution/application/propose-plugins.unit.test.ts`; `tests/orchestration/setup/pick-plugins.unit.test.ts` | split | proposal: decisions go to the catalogue owner, questions to the setup scenario (03 section 4.4) |
| `tests/presentation/prompts/setup-plugins-prompt-use-case.unit.test.ts` | `tests/orchestration/setup/setup-plugins-step.unit.test.ts` | move | proposal: becomes a step of the setup scenario |
| `tests/presentation/prompts/setup-tools-prompt-use-case.unit.test.ts` | `tests/orchestration/setup/setup-tools-step.unit.test.ts` | move | proposal: becomes a step of the setup scenario |
| `tests/presentation/prompts/setup-tools-prompt-recommendations.unit.test.ts` | `tests/contexts/installation/domain/tool-recommendations.unit.test.ts` | move | proposal: tests a domain function of project detection, not a prompt; owner not stated in the documents |
| `tests/presentation/prompts/sync-conflict-resolver-use-case.unit.test.ts` | `tests/contexts/installation/domain/drift.unit.test.ts` | move | proposal: pure hash comparison goes to the single drift function of installation (03 section 4.4) |
| `tests/e2e/helpers.ts` | `tests/e2e/testing/test-env.ts`; `tests/e2e/testing/run-cli.ts`; `tests/e2e/testing/path-without-aidd.ts` | split | proposal: no import of createDeps or any production wiring; initProject runs the built binary instead (07 section 2.1) |
| `tests/e2e/helpers.unit.test.ts` | `tests/e2e/testing/path-without-aidd.unit.test.ts` | rename | follows the extracted path helper |
| `tests/e2e/*` | `tests/e2e/*` | keep | keep all; the e2e policy (one per command and per family of failure, the rest down to integration) is applied under 07 section 5, no file dropped here |
| `tests/helpers/auth.ts` | `tests/contexts/auth/testing/credential-records.ts` | move | done (auth pilot): the record builders of the auth kit |
| `tests/helpers/mutation-sequencer.ts` | `tests/mutation/mutation-sequencer.ts` | move | proposal: mutation tooling is not a kit; delete with the per-profile scopes if they go (07 section 8) |
| `tests/helpers/mutation-sequencer.unit.test.ts` | `tests/mutation/mutation-sequencer.unit.test.ts` | move | follows its subject |
| `tests/helpers/stryker-filter.integration.test.ts` | `tests/mutation/stryker-filter.integration.test.ts` | move | proposal: follows the fate of mutation (07 section 6) |
| `tests/helpers/unloadable-file-as-failed-test.ts` | `tests/mutation/unloadable-file-as-failed-test.ts` | move | proposal: canary support, follows the fate of mutation |
| `tests/helpers/unloadable-file-as-failed-test.integration.test.ts` | `tests/mutation/unloadable-file-as-failed-test.integration.test.ts` | move | follows its subject |
| `tests/helpers/unloadable-file-as-failed-test.unit.test.ts` | `tests/mutation/unloadable-file-as-failed-test.unit.test.ts` | move | follows its subject |
| `tests/helpers/repository-root.ts` | `tests/shared/testing/repository-root.ts` | move | imported by every context and by e2e |
| `tests/helpers/sweep-stale-temp-dirs.ts` | `tests/shared/testing/sweep-stale-temp-dirs.ts` | move | proposal: vitest global setup, referenced by the vitest config |
| `tests/helpers/throwaway-profile.ts` | `tests/shared/testing/throwaway-profile.ts` | move | it is the HOME redirect global setup, not the synthetic tool profiles that 07 section 2.5 names; those are a tools kit addition |
| `tests/helpers/throwaway-profile.unit.test.ts` | `tests/shared/testing/throwaway-profile.unit.test.ts` | move | follows its subject |
| `tests/helpers/vitest-text-loader.ts` | `tests/shared/testing/vitest-text-loader.ts` | move | proposal: vitest plugin shared by every project |
| `tests/helpers/ports/build-unit-deps.ts` | - | delete | replaced by one builder per command in each kit and by composition integration tests (07 section 2.2); its fixture copy goes with it |
| `tests/helpers/ports/index.ts` | - | delete | barrel: kits are imported file by file |
| `tests/helpers/ports/capturing-logger.ts` | `tests/shared/testing/capturing-logger.ts` | move | shared logger fake |
| `tests/helpers/ports/capturing-output.ts` | `tests/shared/testing/capturing-output.ts` | move | proposal: CLIOutput capture, used across layers |
| `tests/helpers/ports/checkbox-recording-prompter.ts` | `tests/shared/testing/checkbox-recording-prompter.ts` | move | prompter fakes live in shared testing (07 section 2.1) |
| `tests/helpers/ports/choosing-prompter.ts` | `tests/shared/testing/choosing-prompter.ts` | move | same |
| `tests/helpers/ports/recording-prompter.ts` | `tests/shared/testing/recording-prompter.ts` | move | same |
| `tests/helpers/ports/scripted-prompter.ts` | `tests/shared/testing/scripted-prompter.ts` | move | same |
| `tests/helpers/ports/deterministic-hasher.ts` | `tests/shared/testing/deterministic-hasher.ts` | move | hasher port is shared |
| `tests/helpers/ports/fake-current-version.ts` | `tests/shared/testing/fake-current-version.ts` | move | VersionReader port moves to shared/ports (05) |
| `tests/helpers/ports/fake-platform.ts` | `tests/shared/testing/fake-platform.ts` | move | platform port is shared |
| `tests/helpers/ports/in-memory-environment.ts` | `tests/shared/testing/in-memory-environment.ts` | move | environment port is shared |
| `tests/helpers/ports/in-memory-file-adapter.ts` | `tests/shared/testing/in-memory-file-adapter.ts` | move | merge logic leaves the fake (about 60 lines) once the file contract suite exists (07 section 2.3) |
| `tests/helpers/ports/faulting-file-adapter.ts` | `tests/shared/testing/faulting-file-adapter.ts` | move | file port fake variant |
| `tests/helpers/ports/seed-from-directory.ts` | `tests/shared/testing/seed-from-directory.ts` | move | proposal: serves the per-test fixture declaration (07 section 2.2) |
| `tests/helpers/ports/stub-asset-provider.ts` | `tests/shared/testing/stub-asset-provider.ts` | move | proposal: AssetProvider is consumed by three contexts (03 open item) |
| `tests/helpers/ports/realpath-windows.unit.test.ts` | `tests/shared/ports/file-realpath-windows.unit.test.ts` | move | proposal: tests the fake against the file port; may fold into the file contract suite |
| `tests/helpers/ports/fake-auth-reader.ts` | `-` | delete | done (auth pilot): its one importer, a framework test, doubles `TokenProvider` inline (A6) |
| `tests/helpers/ports/stub-ai-tool.ts` | `tests/contexts/tools/testing/stub-ai-tool.ts` | move | tools kit |
| `tests/helpers/ports/in-memory-manifest-repository.ts` | `tests/contexts/installation/testing/in-memory-manifest-repository.ts` | move | installation kit |
| `tests/helpers/ports/in-memory-marketplace-cache.ts` | `tests/contexts/distribution/testing/in-memory-marketplace-cache.ts` | move | distribution kit (05) |
| `tests/helpers/ports/in-memory-marketplace-registry.ts` | `tests/contexts/distribution/testing/in-memory-marketplace-registry.ts` | move | distribution kit (05) |
| `tests/helpers/ports/in-memory-marketplace-trust-store.ts` | `tests/contexts/distribution/testing/in-memory-marketplace-trust-store.ts` | move | distribution kit (05) |
| `tests/helpers/ports/fixture-plugin-fetcher.ts` | `tests/contexts/distribution/testing/fixture-plugin-fetcher.ts` | move | PluginFetcher is owned by distribution |
| `tests/helpers/ports/fake-ensure-built-marketplace.ts` | `tests/contexts/distribution/testing/fake-ensure-built-marketplace.ts` | move | proposal: 02 leaves the owner open between distribution and translate |
| `tests/helpers/ports/fake-host-marketplace-registry-reader.ts` | `tests/contexts/host-registration/testing/fake-host-marketplace-registry-reader.ts` | move | native registry ports go to host-registration (04) |
| `tests/helpers/ports/fake-host-plugin-registry-reader.ts` | `tests/contexts/host-registration/testing/fake-host-plugin-registry-reader.ts` | move | same |
| `tests/helpers/ports/fake-native-marketplace-source-reader.ts` | `tests/contexts/host-registration/testing/fake-native-marketplace-source-reader.ts` | move | same |
| `tests/helpers/ports/fake-native-plugin-activator.ts` | `tests/contexts/host-registration/testing/fake-host-actions.ts` | rename | becomes FakeHostActions (02); records calls and simulates CLI refusals |
| - | `tests/shared/testing/run-file-contract.ts`; `tests/shared/ports/file.contract.test.ts` | add | first contract suite to land: fake and fs adapter on a temp dir (07 section 2.3 and 9) |
| - | `tests/contexts/auth/testing/identity-verifier-contract.ts; tests/contexts/auth/ports/identity-verifier.contract.test.ts` | add | done (auth pilot): `describeIdentityVerifierContract` (A7), fake and `GitHubAdapter` over a local server |
| - | `tests/contexts/auth/testing/credential-record-repository-contract.ts; tests/contexts/auth/ports/credential-record-repository.contract.test.ts` | add | done (auth pilot): `describeCredentialRecordRepositoryContract`, fake and file adapter |
| - | `tests/contexts/host-registration/testing/run-host-actions-contract.ts`; `tests/contexts/host-registration/domain/ports/host-actions.contract.test.ts` | add | native host CLI suite replaying recorded vendor output (02, 07 section 4.2) |
| `tests/architecture/helpers.ts` | `tests/architecture/helpers.ts` | keep | holds ALLOWED and BASELINE as data (00 section 11) |
| `tests/architecture/context-graph.arch.test.ts` | `tests/architecture/edge-table.arch.test.ts` | merge | an absent edge is an error; replaces the baselined graph (08 section 2.2) |
| `tests/architecture/context-self-reentry.arch.test.ts` | `tests/architecture/edge-table.arch.test.ts` | merge | proposal: kept separate only while a migration still produces those scars (08), then folded here |
| `tests/architecture/import-rules-bite.arch.test.ts` | `tests/architecture/biome-groups-name-existing-folders.arch.test.ts` | merge | proposal: reduces to one test, every group names a folder that exists, plus planted trees (08 section 2.4) |
| `tests/architecture/biome-guards-bite.arch.test.ts` | `tests/architecture/biome-groups-name-existing-folders.arch.test.ts` | merge | same; the grit plugin part moves to its planted tree |
| `tests/architecture/biome-context-parity.arch.test.ts` | `tests/architecture/biome-context-parity.arch.test.ts` | keep | stays as the single test that the generated derivation is current |
| `tests/architecture/context-boundary.arch.test.ts` | `tests/architecture/public-surface.arch.test.ts` | rename | public surface by path (application and contract), replaces PUBLIC_MODULES |
| `tests/architecture/orchestrator-deps.arch.test.ts` | `tests/architecture/constructor-cap.arch.test.ts` | rename | cap of 5 constructor dependencies per command; offenders go to BASELINE |
| `tests/architecture/folder-size.arch.test.ts` | - | delete | 08 decision: a cap that only goes up guards no drift; the threshold moves to the review grid |
| `tests/architecture/comments.arch.test.ts` | - | delete | 08 decision: the cap has no proven effect; the no date or ticket rule stays in rules |
| `tests/architecture/referenced-paths.arch.test.ts` | - | delete | 08 decision: scripts/check-referenced-paths.js is the single home |
| `tests/architecture/docs-do-not-lie.arch.test.ts` | `tests/architecture/docs-do-not-lie.arch.test.ts` | keep | proposal: 08 says merge into the matching scripts guard or delete; verdict pending, nothing decided here |
| `tests/architecture/bundled-config-checkout.arch.test.ts` | `tests/architecture/bundled-config-checkout.arch.test.ts` | keep | proposal: same pending verdict as above |
| `tests/architecture/hooks-install-from-the-root.arch.test.ts` | `tests/architecture/hooks-install-from-the-root.arch.test.ts` | keep | proposal: same pending verdict as above |
| `tests/architecture/mutation-covers-source.arch.test.ts` | `tests/architecture/mutation-covers-source.arch.test.ts` | keep | moves to CI only, no longer pre-commit (08); scope list follows the new contexts |
| `tests/architecture/mutation-shards.arch.test.ts` | `tests/architecture/mutation-shards.arch.test.ts` | keep | CI only (08) |
| `tests/architecture/paths-select-source.arch.test.ts` | `tests/architecture/paths-select-source.arch.test.ts` | keep | CI only (08) |
| `tests/architecture/tool-addition-cost.arch.test.ts` | `tests/architecture/tool-addition-cost.arch.test.ts` | keep | becomes a computed rule: a tool identifier only in its profile (08) |
| `tests/architecture/earned-sharing.arch.test.ts` | `tests/architecture/earned-sharing.arch.test.ts` | keep | computed, at least 2 importing contexts; deviations are BASELINE entries |
| `tests/architecture/*` | `tests/architecture/*` | keep | deterministic rules with a written rule (catches, errors, no-re-export, ports-are-called, codebase-map, one repository helper, throwaway profile wiring, no-shared-binary, automation-calls-real-scripts); several read application/ instead of the use-case suffix in the renaming PR |
| - | `tests/architecture/contract-has-importer.arch.test.ts` | add | a contract file needs an importer from another context, else it returns to domain (00 section 5, 08) |
| - | `tests/architecture/command-shape.arch.test.ts` | add | one file, one class of the same name, public execute, no UseCase suffix (08) |
| - | `tests/architecture/old-layout-counter.arch.test.ts` | add | files left in runtime, kernel, framework only go down; deleted at the end of the migration (08 section 2.3) |
| - | `tests/architecture/baseline-only-shrinks.arch.test.ts` | add | proposal: BASELINE entries compared with the committed value, never added (00 section 11) |
| - | `tests/architecture/test-file-size.arch.test.ts` | add | 400 lines warning, 800 failure (07 section 1); 08 open item on the warning level |
| - | `tests/architecture/kit-isolation.arch.test.ts` | add | a test never imports another context's kit (07 section 2.1) |
| - | `tests/architecture/test-mirror-path.arch.test.ts` | add | every domain or application module has its mirror test or a written exception (07 section 7) |
| `tests/golden/framework-build-golden.e2e.test.ts` | `tests/golden/framework-build.golden.test.ts` | rename | suffix by level; reduced to the file tree, then in memory once the pure engine lands (07 section 4.3) |
| `tests/golden/golden-baseline.e2e.test.ts` | `tests/golden/cli-baseline.golden.test.ts` | rename | proposal: period name phase0 replaced by what it freezes, the CLI command outputs |
| `tests/golden/help-surface.e2e.test.ts` | `tests/golden/help-surface.golden.test.ts` | rename | suffix by level |
| `tests/golden/two-captures.ts` | `tests/golden/two-captures.ts` | keep | imports the e2e helpers from their new place |
| `tests/golden/snapshots/framework-build/golden.json` | `tests/golden/snapshots/framework-build/golden.json` | keep | reduced to paths and fingerprints (about 2140 lines today) |
| `tests/golden/snapshots/phase0/snapshot.json` | `tests/golden/snapshots/cli-baseline/snapshot.json` | rename | proposal: follows its test rename |
| `tests/golden/snapshots/*` | `tests/golden/snapshots/*` | keep | help and tool-support surfaces stay as user output and capability matrix |
| - | `tests/golden/expect-golden.ts` | add | the single update mechanism: one variable read by expectGolden(name, actual); replaces the three UPDATE variables (07 section 4.3) |
| `tests/scripts/foreign-clock.integration.test.ts` | `tests/scripts/foreign-clock.integration.test.ts` | keep | proposal: tests a cli/scripts guard, no source mirror |
| `tests/fixtures/claude-usage/*` | `tests/fixtures/claude-usage/*` | keep | real journal fixtures, labelled by tool version |
| - | `tests/fixtures/claude-usage/README.md` | add | provenance README (07 section 4.1) |
| - | `tests/fixtures/codex-usage/*` | add | real anonymized Codex records in jsonl and zstd (06) |
| - | `tests/fixtures/hosts/*` | add | recorded host outputs per host and version, replayed by the host contract suites (07 section 4.2) |
| `tests/fixtures/framework/*` | `tests/fixtures/framework/*` | keep | minimal version, declared per test (07 section 4.1) |
| `tests/fixtures/framework-codex/*` | `tests/fixtures/framework/variants/codex/*` | merge | proposal: 5 files with one importer, merge as a variant of framework |
| `tests/fixtures/framework-v2/*` | `tests/fixtures/framework-v2/*` | keep | proposal: differs from framework in about ten files, too wide for a merge; revisit after the importer check |
| `tests/fixtures/framework-win32/*` | - | delete | orphan: no importer found by search (07 section 4.1) |
| `tests/fixtures/framework-real/README.md` | `tests/fixtures/framework-real/README.md` | keep | promises a refresh script that does not exist: create it or drop the promise |
| `tests/fixtures/framework-real/*` | `tests/fixtures/framework-real/*` | keep | single source of smoke and goldens; no longer a unit-test seed; reduce files read by no test (to measure) |
| `tests/fixtures/manifests/*` | `tests/fixtures/manifests/*` | keep | manifest documents; real v8 ones back the installation contract suite |
| `tests/fixtures/plugins/*` | `tests/fixtures/plugins/*` | keep | per-host plugin formats; recorded host fixtures live in fixtures/hosts |
| `tests/fixtures/stryker-canary/*` | `tests/fixtures/stryker-canary/*` | keep | follows the fate of mutation (07 section 4.1) |
| `tests/fixtures/stryker-filter/*` | `tests/fixtures/stryker-filter/*` | keep | follows the fate of mutation |
| `tests/fixtures/unloadable-test-file/node_modules/*` | - | delete | untracked vitest cache, not part of the fixture |
| `tests/fixtures/unloadable-test-file/*` | `tests/fixtures/unloadable-test-file/*` | keep | follows the fate of mutation |
