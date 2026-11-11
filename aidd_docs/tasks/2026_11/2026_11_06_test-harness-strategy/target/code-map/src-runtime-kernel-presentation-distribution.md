# Code map: runtime, kernel, presentation, distribution, cli.ts

Current paths are relative to `cli/`. `runtime` dissolves into `composition`, `shared`, `auth` and `update`; `kernel` becomes `shared`; `presentation` stays the driving adapter; `distribution` is renamed in place. Context ports move from `domain/ports/` to `ports/`, following the target layout rule.

| Current | Target | Action | Note |
| --- | --- | --- | --- |
| `src/cli.ts` | `src/cli.ts` | keep | builds the container, registers commands; no adapter import |
| - | `src/presentation/hooks/update-notice-hooks.ts` | add | pre and post action hooks moved out of `cli.ts` |
| `src/runtime/wiring/framework.ts` | `src/composition/container.ts; src/composition/installation.ts; src/composition/host-registration.ts; src/composition/machine-claims.ts; src/composition/recipes.ts; src/composition/orchestration.ts` | split | proposal: one module per context plus the root, memoized per container |
| `src/runtime/wiring/telemetry.ts` | `src/composition/telemetry.ts` | move | |
| `src/runtime/wiring/translate.ts` | `src/composition/translate.ts` | move | |
| `src/runtime/wiring/distribution.ts` | `src/composition/distribution.ts` | move | |
| `src/runtime/wiring/tools.ts` | `src/composition/tool-profiles/registry.ts` | move | proposal: the single registration list, no import side effect |
| - | `src/composition/shared.ts` | add | files, hashing, HTTP, forge adapter, logger, version, home |
| - | `src/composition/auth.ts` | add | done (auth pilot): `wireAuth` builds the three commands and the `TokenProvider`; called by `runtime/wiring/framework.ts` until the root moves (M5) |
| - | `src/composition/update.ts` | add | builds only the update graph, for the notice hooks |
| - | `src/composition/tool-profiles/*` | add | one file per tool; owned by the tools mapping |
| `src/runtime/user-config-dir.ts` | `src/shared/domain/user-config-dir.ts; src/composition/user-config-dir.ts` | split | pure `userConfigDirOf(env, home)` to shared, env and home wrapper to composition |
| `src/runtime/assets/asset-loader.ts` | `src/shared/infrastructure/asset-loader.ts` | move | proposal: config assets may later migrate into tool profiles |
| `src/runtime/assets/text-assets.d.ts` | `src/shared/infrastructure/text-assets.d.ts` | move | follows the loader |
| `src/runtime/filesystem/atomic-write.ts` | `src/shared/infrastructure/atomic-write.ts` | move | port type `AtomicWrite` added in `shared/ports` |
| `src/runtime/filesystem/file-adapter.ts` | `src/shared/infrastructure/file-adapter.ts` | move | |
| `src/runtime/filesystem/hasher-adapter.ts` | `src/shared/infrastructure/hasher-adapter.ts` | move | |
| `src/runtime/filesystem/private-storage-adapter.ts` | `src/shared/infrastructure/private-storage-adapter.ts` | move | conflict: telemetry and kernel documents say telemetry; shared kept, three contexts need it |
| `src/runtime/git/git-environment.ts` | `src/contexts/telemetry/infrastructure/git-environment.ts` | move | single consumer context |
| `src/runtime/git/inject-token.ts` | `src/contexts/distribution/infrastructure/inject-token.ts` | move | |
| `src/runtime/http/http-client.ts` | `src/shared/infrastructure/http-client.ts` | move | implements the new `HttpGet` port |
| `src/runtime/platform/platform.ts` | `src/shared/ports/platform.ts` | move | conflict: installation vs shared; overview lists platform among shared ports |
| `src/runtime/platform/platform-adapter.ts` | `src/shared/infrastructure/platform-adapter.ts` | move | |
| `src/runtime/project-root/project-root.ts` | `src/presentation/project-root.ts` | move | reads `PWD`, single presentation importer |
| `src/runtime/prompter/prompter-adapter.ts` | `src/presentation/terminal/prompter-adapter.ts` | move | implements the `orchestration` prompt port |
| `src/runtime/auth/auth.ts` | `src/contexts/auth/contract/credential.ts; src/contexts/auth/domain/credential-record.ts` | split | done (auth pilot): the types presentation reads in `contract/`, the aggregate `CredentialRecord` and its rules in `domain/` |
| `src/runtime/auth/auth-login-use-case.ts` | `src/contexts/auth/application/log-in.ts` | rename | done (auth pilot): command `LogIn`, verb-first (A4) |
| `src/runtime/auth/auth-logout-use-case.ts` | `src/contexts/auth/application/log-out.ts` | rename | done (auth pilot): command `LogOut` |
| `src/runtime/auth/auth-status-use-case.ts` | `src/contexts/auth/application/check-status.ts` | rename | done (auth pilot): command `CheckStatus` |
| `src/runtime/auth/auth-provider-adapter.ts` | `-` | delete | done (auth pilot): its three methods became the three commands, its rules the aggregate's; no `credential-session.ts` (A3) |
| `src/runtime/auth/auth-reader-adapter.ts` | `src/contexts/auth/domain/credential-sources.ts; src/contexts/auth/application/cached-token-provider.ts` | split | done (auth pilot): the one source order and its two stop rules in the domain, memo and logs in `application/` (E5); `resolveContext` deleted |
| `src/runtime/auth/auth-storage.ts` | `src/contexts/auth/infrastructure/credential-record-file-adapter.ts` | rename | done (auth pilot): level-keyed, created `0600`; permissions stay here, shared private storage not adopted (E9) |
| `src/runtime/auth/gh-cli-adapter.ts` | `src/contexts/auth/infrastructure/gh-cli-adapter.ts` | move | done (auth pilot): `resolve` renamed `read` |
| `src/runtime/auth/gh-token-adapter.ts` | `src/shared/infrastructure/github-adapter.ts` | merge | done (auth pilot) (foundations, then `apiBase` in the pilot): the `IdentityVerifier` of auth by shape |
| `src/runtime/auth/ports/credential-store.ts` | `-` | delete | done (auth pilot): its result types are the commands' own |
| `src/runtime/auth/ports/credential-file-store.ts` | `src/contexts/auth/ports/credential-record-repository.ts` | rename | done (auth pilot): the level-keyed repository of the aggregate |
| `src/runtime/auth/ports/oauth-provider.ts` | `src/contexts/auth/ports/external-token-source.ts; src/contexts/auth/ports/cli-auth-provider.ts; src/contexts/auth/ports/identity-verifier.ts` | split | done (auth pilot): one interface per file |
| `src/runtime/auth/ports/token-provider.ts` | `src/contexts/auth/contract/token-provider.ts` | move | done (auth pilot): published to distribution, framework and self-update |
| `src/runtime/self-update/self-update-use-case.ts` | `src/contexts/update/domain/update-decision.ts; src/contexts/update/application/self-update.ts` | split | pure decision extracted, command renamed |
| `src/runtime/self-update/check-update-use-case.ts` | `src/contexts/update/application/print-update-notice.ts; src/contexts/update/application/refresh-update-check.ts; src/contexts/update/infrastructure/update-check-cache-adapter.ts` | split | cache path becomes an adapter |
| `src/runtime/self-update/self-updater.ts` | `src/contexts/update/ports/cli-release-source.ts; src/contexts/update/ports/cli-installer.ts` | split | one port per responsibility |
| `src/runtime/self-update/self-updater-adapter.ts` | `src/contexts/update/infrastructure/npm-registry-release-adapter.ts; src/contexts/update/infrastructure/package-manager-installer-adapter.ts` | split | |
| `src/runtime/self-update/current-version-adapter.ts` | `src/shared/infrastructure/current-version-adapter.ts` | move | `VersionReader` consumed by installation and update |
| `src/runtime/self-update/latest-release-resolver.ts` | `src/shared/ports/release-lister.ts; src/shared/ports/repository-reader.ts` | split | `listRootReleases` and `isRepoPublic` go to forge ports; `resolveLatest` deleted |
| `src/runtime/self-update/github-release-resolver-adapter.ts` | `src/shared/infrastructure/github-adapter.ts` | merge | the `ReleaseLister` part of the single GitHub adapter |
| - | `src/shared/infrastructure/github-adapter.ts` | add | one adapter for `RepositoryReader`, `ReleaseLister`, `IdentityVerifier`; sole owner of the API URL |
| - | `src/contexts/auth/ports/identity-verifier.ts` | add | done (auth pilot): token check; the shared GitHub adapter satisfies it by shape, wired in `composition` |
| - | `src/shared/ports/http-get.ts` | add | port for the shared HTTP client |
| `src/kernel/describe-error.ts` | `src/shared/domain/describe-error.ts` | move | |
| `src/kernel/errors.ts` | `src/shared/domain/errors.ts; src/presentation/errors/error-messages.ts` | split | typed catalogue stays; text naming a command or flag moves to the message table |
| `src/kernel/file.ts` | `src/shared/domain/file.ts` | move | |
| `src/kernel/markdown.ts` | `src/shared/domain/markdown.ts` | move | |
| `src/kernel/merge.ts` | `src/shared/domain/merge.ts` | move | |
| `src/kernel/materialization/*` | `src/shared/domain/materialization/*` | move | `node:path` must leave these files |
| `src/kernel/paths.ts` | `src/shared/domain/paths.ts; src/contexts/distribution/domain/marketplace-cache-paths.ts; src/contexts/installation/domain/manifest-paths.ts` | split | pure comparison stays shared with platform as parameter; proposal: owner file names for cache and manifest layout |
| `src/kernel/scope.ts` | `src/shared/domain/scope.ts` | move | becomes the single `Scope` type, merged with the install scope |
| `src/kernel/semver.ts` | `src/shared/domain/semver.ts` | move | installation and update both import it |
| `src/kernel/source.ts` | `src/shared/domain/source.ts` | move | provisional; natural owner is distribution |
| `src/kernel/tool.ts` | `src/shared/domain/tool.ts; src/presentation/commands/tool-option.ts` | split | `assertValidAiToolId` and `parseToolOption` go to presentation; id union derived from the registration list |
| `src/kernel/ports/file-reader.ts` | `src/shared/ports/file-reader.ts` | move | |
| `src/kernel/ports/file-writer.ts` | `src/shared/ports/file-writer.ts` | move | |
| `src/kernel/ports/hasher.ts` | `src/shared/ports/hasher.ts` | move | |
| `src/kernel/ports/logger.ts` | `src/shared/ports/logger.ts` | move | |
| `src/kernel/ports/version-reader.ts` | `src/shared/ports/version-reader.ts` | move | |
| `src/kernel/ports/asset-provider.ts` | `src/shared/ports/asset-provider.ts` | move | proposal: consumed by three contexts, kept shared while assets stay in one adapter |
| `src/kernel/ports/prompter.ts` | `src/orchestration/ports/prompter.ts` | move | proposal: prompt port owned by orchestration, folder name not stated |
| `src/kernel/reading/json-file.ts` | `src/shared/domain/reading/json-file.ts` | move | may be duplicated instead |
| `src/kernel/reading/jsonc.ts` | `src/shared/domain/reading/jsonc.ts` | move | |
| `src/kernel/reading/plain-object.ts` | `src/shared/domain/reading/plain-object.ts` | move | may be duplicated instead |
| `src/kernel/reading/text-file.ts` | `src/contexts/telemetry/infrastructure/text-file.ts` | move | telemetry only, uses `node:fs`; proposal: file location inside infrastructure |
| `src/kernel/reading/home-dir.ts` | - | delete | composition resolves the home once and injects it |
| `src/presentation/commands/auth.ts` | `src/presentation/commands/auth.ts` | keep | done (auth pilot): receives the commands from `createDeps`, no `new` (M4 until `cli.ts` hands the container) |
| `src/presentation/commands/clean.ts` | `src/presentation/commands/clean.ts` | keep | thin |
| `src/presentation/commands/doctor.ts` | `src/presentation/commands/doctor.ts` | keep | `healthy` decision moves into the doctor scenario |
| `src/presentation/commands/framework.ts` | `src/presentation/commands/framework.ts; src/presentation/commands/recipes.ts` | split | `validate-recipes` moves to recipes, CLI name unchanged |
| `src/presentation/commands/global-options.ts` | `src/presentation/commands/global-options.ts` | keep | |
| `src/presentation/commands/marketplace.ts` | `src/presentation/commands/marketplace.ts` | keep | thin |
| `src/presentation/commands/menu.ts` | `src/presentation/commands/menu.ts; src/orchestration/menu/menu-loop.ts` | split | proposal: loop logic to orchestration, terminal part stays; error routed through the common translator |
| `src/presentation/commands/plugin.ts` | `src/presentation/commands/plugin.ts` | keep | thin |
| `src/presentation/commands/setup.ts` | `src/presentation/commands/setup.ts` | keep | no `new`, scenario received |
| `src/presentation/commands/spawn-cli-command.ts` | `src/orchestration/menu/spawn-cli-command.ts` | move | |
| `src/presentation/commands/sync-native-activation.ts` | `src/orchestration/sync/sync-native-activation.ts` | move | conflict: host-registration document keeps it; scenario logic per the presentation document |
| `src/presentation/commands/sync.ts` | `src/presentation/commands/sync.ts` | keep | thin |
| `src/presentation/commands/telemetry.ts` | `src/presentation/commands/telemetry.ts; src/contexts/telemetry/application/*` | split | proposal: parse and display stay, validation and identity choice move down |
| `src/presentation/commands/translate.ts` | `src/presentation/commands/translate.ts` | keep | |
| `src/presentation/commands/update.ts` | `src/presentation/commands/update.ts` | keep | |
| `src/presentation/display/*` | `src/presentation/display/*` | keep | one display file per command, no logic |
| `src/presentation/error-handler.ts` | `src/presentation/errors/error-translator.ts` | merge | translator reads `error.code`, falls back on `error.message` |
| `src/presentation/output.ts` | `src/presentation/terminal/output.ts` | move | `CLIOutput` as `Logger` |
| `src/presentation/prompts/menu-use-case.ts` | `src/orchestration/menu/build-menu.ts` | rename | proposal: menu tree and argv production; rendering stays in presentation |
| `src/presentation/prompts/plugin-pick-use-case.ts` | `src/orchestration/plugin/pick-plugins.ts` | move | proposal: questions as a scenario step, neutral decisions extracted to the owning context at move time |
| `src/presentation/prompts/setup-plugins-prompt-use-case.ts` | `src/orchestration/setup/choose-plugins.ts` | rename | proposal: step name |
| `src/presentation/prompts/setup-tools-prompt-use-case.ts` | `src/orchestration/setup/choose-tools.ts` | rename | proposal: step name |
| `src/presentation/prompts/sync-conflict-resolver-use-case.ts` | `src/contexts/installation/application/resolve-sync-conflict.ts` | rename | proposal: file name; pure hash comparison, no question |
| `src/contexts/distribution/application/fetch-marketplace-source-use-case.ts` | `src/contexts/distribution/application/fetch-marketplace-source.ts` | rename | command |
| `src/contexts/distribution/application/marketplace-add-use-case.ts` | `src/contexts/distribution/application/add-marketplace.ts` | rename | no remover dependency; a failed fetch must not leave the previous marketplace removed |
| `src/contexts/distribution/application/marketplace-list-use-case.ts` | `src/contexts/distribution/application/list-marketplaces.ts` | rename | |
| `src/contexts/distribution/application/marketplace-refresh-use-case.ts` | `src/contexts/distribution/application/refresh-marketplace.ts` | rename | |
| `src/contexts/distribution/application/marketplace-register-framework-use-case.ts` | `src/contexts/distribution/application/register-framework-marketplace.ts` | rename | |
| `src/contexts/distribution/application/resolve-marketplace-use-case.ts` | `src/contexts/distribution/application/resolve-marketplace.ts` | rename | |
| - | `src/contexts/distribution/application/list-marketplace-releases.ts` | add | root releases, from framework |
| - | `src/contexts/distribution/application/assert-marketplace-readable.ts` | add | absorbs the access guard living in framework |
| `src/contexts/distribution/domain/catalog.ts` | `src/contexts/distribution/domain/catalog-parsers/claude-marketplace-catalog.ts` | rename | symmetry with the Copilot reader |
| `src/contexts/distribution/domain/catalog-parsers/copilot-marketplace-catalog.ts` | `src/contexts/distribution/domain/catalog-parsers/copilot-marketplace-catalog.ts` | keep | |
| `src/contexts/distribution/domain/marketplace-source-mode.ts` | `src/contexts/distribution/domain/marketplace-source-mode.ts` | keep | vocabulary overlap with `PluginSource` to settle |
| `src/contexts/distribution/domain/marketplace.ts` | `src/contexts/distribution/domain/marketplace.ts` | keep | |
| `src/contexts/distribution/domain/ports/*` | `src/contexts/distribution/ports/*` | move | folder moved to the context-level `ports/` per the layout rule |
| `src/contexts/distribution/infrastructure/github-raw-fetcher-adapter.ts` | `src/contexts/distribution/infrastructure/github-raw-fetcher-adapter.ts` | keep | goes through `RepositoryReader`, no URL of its own |
| `src/contexts/distribution/infrastructure/plugin-fetcher-adapter.ts` | `src/contexts/distribution/infrastructure/plugin-fetcher-adapter.ts; src/contexts/distribution/infrastructure/git-source-fetcher.ts; src/contexts/distribution/infrastructure/npm-source-fetcher.ts` | split | routing and local stay, git and npm separated |
| `src/contexts/distribution/infrastructure/marketplace-cache-adapter.ts` | `src/contexts/distribution/infrastructure/marketplace-cache-adapter.ts` | keep | |
| `src/contexts/distribution/infrastructure/marketplace-registry-adapter.ts` | `src/contexts/distribution/infrastructure/marketplace-registry-adapter.ts` | keep | user folder and atomic write by constructor |
| `src/contexts/distribution/infrastructure/marketplace-trust-store-adapter.ts` | `src/contexts/distribution/infrastructure/marketplace-trust-store-adapter.ts` | keep | writes through the shared private-storage port |
| `src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.ts` | `src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.ts` | keep | reader precedence rule moves up to the domain |
