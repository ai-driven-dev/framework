# Code map: `src/contexts/framework/`

Every file of the current `framework` context, mapped one row each. Paths are relative to `cli/`. Use cases lose their `UseCase` suffix and become commands (file kebab-case, class of the same name).

| Current | Target | Action | Note |
| --- | --- | --- | --- |
| `src/contexts/framework/domain/manifest.ts` | `src/contexts/installation/domain/manifest.ts` | move | drop `getNativeRegistrations` and `setNativeRegistrations` |
| `src/contexts/framework/domain/manifest-serialization.ts` | `src/contexts/installation/domain/manifest-serialization.ts` | move | |
| `src/contexts/framework/domain/manifest-gitignore-entries.ts` | `src/contexts/installation/domain/manifest-gitignore-entries.ts` | move | |
| `src/contexts/framework/domain/manifest/merge-files.ts` | `src/contexts/installation/domain/manifest/merge-files.ts` | move | |
| `src/contexts/framework/domain/manifest/tool-entry.ts` | `src/contexts/installation/domain/manifest/tool-entry.ts` | move | |
| `src/contexts/framework/domain/manifest/tracked-files.ts` | `src/contexts/installation/domain/manifest/tracked-files.ts` | move | |
| `src/contexts/framework/domain/manifest/native-registrations.ts` | `src/contexts/host-registration/domain/registration-record.ts`; `src/contexts/machine-claims/domain/plugin-claim.ts` | split | `RegistrationRecord` to host-registration; `NativePluginClaim` to claims; installation no longer imports it |
| `src/contexts/framework/domain/plugins/installed-plugin.ts` | `src/contexts/installation/domain/installed-plugin.ts`; `src/contexts/installation/domain/file-provenance.ts`; `src/contexts/machine-claims/domain/plugin-claim.ts` | split | 11 fields reduced to 6; `dependents` leaves for claims; proposal: provenance file name |
| `src/contexts/framework/domain/plugins/user-scope-containment.ts` | `src/contexts/machine-claims/domain/user-scope-containment.ts` | move | |
| `src/contexts/framework/domain/plugins/plugin-source-resolver.ts` | `src/contexts/distribution/domain/plugin-source-resolver.ts` | move | |
| `src/contexts/framework/domain/plugins/requested-version-policy.ts` | `src/contexts/distribution/domain/requested-version-policy.ts` | move | |
| `src/contexts/framework/domain/install-scope.ts` | `src/shared/domain/scope.ts` | merge | merged with `kernel/scope.ts`; `getToolSupportedScope` becomes a command input |
| `src/contexts/framework/domain/installed-rule.ts` | `src/contexts/installation/domain/installed-rule.ts` | move | |
| `src/contexts/framework/domain/config-capability.ts` | `src/contexts/tools/domain/sections/config.ts` | move | proposal: folder `sections/` from the tools document, file name chosen here |
| `src/contexts/framework/domain/formats/markdown-references.ts` | `src/orchestration/doctor/markdown-references.ts` | move | used only by the references check |
| `src/contexts/framework/domain/marketplace-source-drift.ts` | `src/contexts/host-registration/domain/source-drift.ts` | move | |
| `src/contexts/framework/domain/doctor.ts` | `src/orchestration/doctor/doctor-report.ts` | rename | proposal: file name; report types of the doctor scenario |
| `src/contexts/framework/domain/project-context.ts` | `src/orchestration/setup/project-context.ts` | move | |
| `src/contexts/framework/domain/setup-flow.ts` | `src/orchestration/setup/setup-flow.ts` | move | |
| `src/contexts/framework/domain/tool-recommendations.ts` | `src/orchestration/setup/tool-recommendations.ts` | move | |
| `src/contexts/framework/domain/ports/manifest-repository.ts` | `src/contexts/installation/ports/manifest-repository.ts`; `src/contexts/machine-claims/ports/lock.ts` | split | optional lock leaves as a `Lock` port; proposal: lock file name |
| `src/contexts/framework/domain/ports/environment.ts` | `src/shared/ports/environment.ts` | move | |
| `src/contexts/framework/domain/ports/user-source-references.ts` | `src/contexts/machine-claims/ports/user-source-references.ts` | move | |
| `src/contexts/framework/domain/ports/plugin-distribution-reader.ts` | `src/contexts/distribution/ports/plugin-distribution-reader.ts` | move | |
| `src/contexts/framework/domain/ports/recipe-files.ts` | `src/contexts/recipes/ports/recipe-files.ts` | move | |
| `src/contexts/framework/domain/recipes/recipe-validation.ts` | `src/contexts/recipes/domain/markdown-scan.ts`; `src/contexts/recipes/domain/recipe-rules.ts` | split | scanner apart from recipe rules |
| `src/contexts/framework/infrastructure/manifest-file-io.ts` | `src/contexts/installation/infrastructure/manifest-file-io.ts` | move | |
| `src/contexts/framework/infrastructure/manifest-repository-adapter.ts` | `src/contexts/installation/infrastructure/manifest-repository-adapter.ts` | move | |
| `src/contexts/framework/infrastructure/user-manifest-repository-adapter.ts` | `src/contexts/installation/infrastructure/user-manifest-repository-adapter.ts`; `src/contexts/machine-claims/infrastructure/lock.ts` | split | file access stays, exclusive lock leaves |
| `src/contexts/framework/infrastructure/user-source-references-adapter.ts` | `src/contexts/machine-claims/infrastructure/user-source-references-adapter.ts` | move | |
| `src/contexts/framework/infrastructure/environment-adapter.ts` | `src/shared/infrastructure/environment-adapter.ts` | move | proposal: installation document says `composition/`; overview rule 6 puts the adapter of a shared port in `shared/infrastructure` |
| `src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.ts` | `src/contexts/distribution/infrastructure/plugin-distribution-reader-adapter.ts` | move | |
| `src/contexts/framework/infrastructure/recipe-files-adapter.ts` | `src/contexts/recipes/infrastructure/recipe-files-adapter.ts` | move | |
| `src/contexts/framework/application/recipes/validate-recipes-use-case.ts` | `src/contexts/recipes/application/validate-recipes.ts` | rename | class `ValidateRecipes` |
| `src/contexts/framework/application/install/content/install-agents-use-case.ts` | `src/contexts/installation/application/install/content/install-agents.ts` | rename | |
| `src/contexts/framework/application/install/content/install-commands-use-case.ts` | `src/contexts/installation/application/install/content/install-commands.ts` | rename | |
| `src/contexts/framework/application/install/content/install-content-section-use-case.ts` | `src/contexts/installation/application/install/content/install-content-section.ts` | rename | |
| `src/contexts/framework/application/install/content/install-rules-use-case.ts` | `src/contexts/installation/application/install/content/install-rules.ts` | rename | |
| `src/contexts/framework/application/install/content/install-skills-use-case.ts` | `src/contexts/installation/application/install/content/install-skills.ts` | rename | |
| `src/contexts/framework/application/install/install-ai-tool-use-case.ts` | `src/contexts/installation/application/install/install-ai-tool.ts` | rename | |
| `src/contexts/framework/application/install/install-config-use-case.ts` | `src/contexts/installation/application/install/install-config.ts` | rename | |
| `src/contexts/framework/application/install/install-ide-config-use-case.ts` | `src/contexts/installation/application/install/install-ide-config.ts` | rename | |
| `src/contexts/framework/application/install/install-ide-tool-use-case.ts` | `src/contexts/installation/application/install/install-ide-tool.ts` | rename | |
| `src/contexts/framework/application/install/install-runtime-config-use-case.ts` | `src/contexts/installation/application/install/install-runtime-config.ts` | rename | |
| `src/contexts/framework/application/install/post-install-pipeline-use-case.ts` | `src/orchestration/setup/post-install-pipeline.ts` | merge | merges into the setup scenario |
| `src/contexts/framework/application/restore/generate-tool-distribution-use-case.ts` | `src/contexts/installation/application/restore/generate-tool-distribution.ts` | rename | |
| `src/contexts/framework/application/restore/resolve-restore-decision.ts` | `src/contexts/installation/application/restore/resolve-restore-decision.ts` | move | command rename not stated: class carries `UseCase` suffix today, drop it |
| `src/contexts/framework/application/restore/restore-all-plugins-use-case.ts` | `src/contexts/installation/application/restore/restore-all-plugins.ts` | rename | |
| `src/contexts/framework/application/restore/restore-drift-entries-use-case.ts` | `src/contexts/installation/application/restore/restore-drift-entries.ts` | rename | drift policy merged here |
| `src/contexts/framework/application/restore/restore-merge-files-use-case.ts` | `src/contexts/installation/application/restore/restore-merge-files.ts` | rename | |
| `src/contexts/framework/application/restore/restore-regular-files-use-case.ts` | `src/contexts/installation/application/restore/restore-regular-files.ts` | rename | |
| `src/contexts/framework/application/restore/restore-tool-files-use-case.ts` | `src/contexts/installation/application/restore/restore-tool-files.ts` | rename | |
| `src/contexts/framework/application/restore/restore-use-case.ts` | `src/contexts/installation/application/restore/restore.ts` | rename | class `Restore` |
| `src/contexts/framework/application/plugin/plugin-install-use-case.ts` | `src/contexts/installation/application/plugin/install-plugin.ts` | rename | |
| `src/contexts/framework/application/plugin/plugin-update-use-case.ts` | `src/contexts/installation/application/plugin/update-plugin.ts` | rename | absorbs the user-scope update with a scope parameter |
| `src/contexts/framework/application/plugin/plugin-list-use-case.ts` | `src/contexts/installation/application/plugin/list-plugins.ts` | rename | |
| `src/contexts/framework/application/plugin/plugin-helpers.ts` | `src/contexts/installation/application/plugin/plugin-helpers.ts` | move | |
| `src/contexts/framework/application/plugin/plugin-target-resolution.ts` | `src/contexts/installation/application/plugin/plugin-target-resolution.ts` | move | |
| `src/contexts/framework/application/plugin/plugin-add-use-case.ts` | `src/contexts/installation/application/plugin/add-plugin.ts`; `src/contexts/host-registration/application/register-plugin-with-host.ts`; `src/contexts/machine-claims/application/claim-user-plugin.ts`; `src/orchestration/plugin/add-plugin-everywhere.ts` | split | placement, host registration and claim separate; proposal: claims and scenario file names |
| `src/contexts/framework/application/plugin/plugin-remove-use-case.ts` | `src/contexts/installation/application/plugin/remove-plugin.ts`; `src/contexts/host-registration/application/withdraw-from-host.ts`; `src/orchestration/plugin/remove-plugin-everywhere.ts` | split | proofs and host calls replaced by `WithdrawFromHost`; proposal: scenario file name |
| `src/contexts/framework/application/plugin/plugin-search-use-case.ts` | `src/contexts/distribution/application/search-plugins.ts` | rename | |
| `src/contexts/framework/application/plugin/plugin-distribution-loader.ts` | `src/contexts/distribution/application/load-plugin-distribution.ts` | rename | proposal: verb-first name |
| `src/contexts/framework/application/plugin/plugin-install-from-marketplace-use-case.ts` | `src/orchestration/plugin/install-plugin-from-marketplace.ts` | rename | install from the catalogue is a scenario |
| `src/contexts/framework/application/status-use-case.ts` | `src/contexts/installation/application/report-status.ts` | rename | proposal: verb-first name |
| `src/contexts/framework/application/list-installed-rules-use-case.ts` | `src/contexts/installation/application/list-installed-rules.ts` | rename | |
| `src/contexts/framework/application/gitignore-use-case.ts` | `src/contexts/installation/application/update-gitignore.ts` | rename | proposal: verb-first name |
| `src/contexts/framework/application/init-use-case.ts` | `src/contexts/installation/application/init-project.ts` | rename | proposal: installation document maps `init` to `orchestration/`, but it writes manifest and gitignore, which is installation (setup decomposition) |
| `src/contexts/framework/application/shared/apply-plugin-files-use-case.ts` | `src/contexts/installation/application/apply-plugin-files.ts` | rename | |
| `src/contexts/framework/application/shared/detect-plugin-drift-use-case.ts` | `src/contexts/installation/application/detect-plugin-drift.ts` | rename | the single drift comparison |
| `src/contexts/framework/application/shared/remove-project-hooks.ts` | `src/contexts/installation/application/remove-project-hooks.ts` | move | |
| `src/contexts/framework/application/shared/user-scope-plugin-files.ts` | `src/contexts/machine-claims/application/user-scope-plugin-files.ts` | move | |
| `src/contexts/framework/application/shared/shared-source-reference-support.ts` | `src/contexts/machine-claims/application/shared-source-reference-support.ts` | move | |
| `src/contexts/framework/application/shared/best-effort-native-call.ts` | `src/contexts/host-registration/application/confirmation.ts` | merge | |
| `src/contexts/framework/application/shared/host-marketplace-source-conflict.ts` | `src/contexts/host-registration/application/source-check.ts` | move | |
| `src/contexts/framework/application/shared/read-marketplace-catalog-identity.ts` | `src/contexts/host-registration/infrastructure/catalog-identity-reader.ts` | move | |
| `src/contexts/framework/application/shared/purge-native-marketplace-cache.ts` | `src/contexts/host-registration/domain/cache-purge-policy.ts`; `src/contexts/host-registration/application/withdraw-from-host.ts` | split | policy in domain, private step of the command |
| `src/contexts/framework/application/shared/purge-declared-cache.ts` | `src/contexts/host-registration/domain/cache-purge-policy.ts`; `src/shared/domain/path-containment.ts` | split | containment moves to shared only if installation also imports it (computed rule); proposal: shared file name |
| `src/contexts/framework/application/shared/resolve-uninstall-scope.ts` | `src/contexts/host-registration/domain/uninstall-scope-order.ts` | move | conflict: installation document says `orchestration/clean`; host-registration document wins as the file reads a host registry |
| `src/contexts/framework/application/shared/setup-marketplace-registration-use-case.ts` | `src/orchestration/marketplace/register-marketplace.ts` | rename | calls `RegisterPluginWithHost`; proposal: verb-first name |
| `src/contexts/framework/application/shared/ensure-built-marketplace-use-case.ts` | `src/orchestration/marketplace/ensure-built-marketplace.ts` | rename | proposal: documents say distribution or translate, but it calls both and the context map has no edge between them, so the scenario layer owns it |
| `src/contexts/framework/application/ownership/native-host-registration-gate.ts` | `src/contexts/host-registration/domain/registration-policy.ts` | merge | |
| `src/contexts/framework/application/ownership/native-marketplace-source-proof.ts` | `src/contexts/host-registration/domain/source-proof.ts` | move | |
| `src/contexts/framework/application/ownership/native-plugin-ownership.ts` | `src/contexts/machine-claims/application/native-plugin-ownership.ts`; `src/contexts/host-registration/contract/claims-view.ts` | split | read side published as `ClaimsView`; `detachNativePluginRefs` stays in claims |
| `src/contexts/framework/application/ownership/user-plugin-ownership.ts` | `src/contexts/machine-claims/application/user-plugin-ownership.ts` | move | conflict: host-registration document says keep in installation; installation document and overview put ownership in claims |
| `src/contexts/framework/application/ownership/user-plugin-update-use-case.ts` | `src/contexts/installation/application/plugin/update-plugin.ts`; `src/contexts/host-registration/application/refresh-host-plugin.ts` | merge | files merge into `UpdatePlugin`, host part split off |
| `src/contexts/framework/application/ownership/user-plugin-file-updater.ts` | `src/contexts/installation/application/plugin/update-plugin.ts` | merge | |
| `src/contexts/framework/application/ownership/user-marketplace-remove-use-case.ts` | `src/contexts/host-registration/application/withdraw-from-host.ts`; `src/orchestration/marketplace/remove-user-marketplace.ts` | split | host part vs files and manifest; proposal: scenario file name |
| `src/contexts/framework/application/ownership/project-plugin-cleanup.ts` | `src/contexts/installation/application/project-plugin-cleanup.ts` | move | |
| `src/contexts/framework/application/ownership/project-path-boundary.ts` | `src/contexts/installation/application/project-path-boundary.ts` | move | |
| `src/contexts/framework/application/framework/translator/plugin-translator.ts` | `src/contexts/installation/application/materialize/plugin-materializer.ts` | rename | proposal: avoids the word translator, owned by translate |
| `src/contexts/framework/application/framework/translator/plugin-translator-factory.ts` | `src/contexts/installation/application/materialize/plugin-materializer-factory.ts` | rename | proposal |
| `src/contexts/framework/application/framework/translator/resolve-plugin-translator.ts` | `src/contexts/installation/application/materialize/resolve-plugin-materializer.ts` | rename | proposal |
| `src/contexts/framework/application/framework/translator/mode-a-marketplace-translator.ts` | `src/contexts/installation/application/materialize/marketplace-materializer.ts` | rename | proposal: name by what it does |
| `src/contexts/framework/application/framework/translator/mode-b-flat-materialization-translator.ts` | `src/contexts/installation/application/materialize/flat-materializer.ts`; `src/contexts/translate/application/translate-flat-plugin.ts` | split | proposal: manifest writing stays, transformation goes to translate |
| `src/contexts/framework/application/framework/translator/built-tree-materialization-translator.ts` | `src/contexts/installation/application/materialize/built-tree-materializer.ts`; `src/contexts/translate/application/translate-built-tree.ts` | split | proposal: same principle |
| `src/contexts/framework/application/framework/translator/flat-mcp-materializer.ts` | `src/contexts/translate/domain/flat-mcp-materializer.ts`; `src/contexts/installation/application/materialize/flat-mcp-materializer.ts` | split | proposal: MCP merge to translate, manifest entries stay |
| `src/contexts/framework/application/framework/translator/project-hooks-materializer.ts` | `src/contexts/translate/domain/project-hooks-materializer.ts`; `src/contexts/installation/application/materialize/project-hooks-materializer.ts` | split | proposal: same principle |
| `src/contexts/framework/application/flows/marketplace-sync-settings-use-case.ts` | `src/orchestration/sync/sync-settings.ts`; `src/contexts/host-registration/application/register-plugin-with-host.ts`; `src/contexts/host-registration/domain/registration-policy.ts`; `src/contexts/host-registration/domain/registration-projection.ts`; `src/contexts/host-registration/domain/settings-declaration.ts` | split | 1387 lines, 15 parameters |
| `src/contexts/framework/application/flows/marketplace-remove-use-case.ts` | `src/orchestration/marketplace/remove-marketplace.ts` | rename | keeps only the manifest update |
| `src/contexts/framework/application/flows/marketplace-check-use-case.ts` | `src/orchestration/marketplace/check-marketplace.ts` | rename | |
| `src/contexts/framework/application/setup-use-case.ts` | `src/orchestration/setup/setup-project.ts` | rename | proposal: verb-first name |
| `src/contexts/framework/application/setup/setup-machine-scope-use-case.ts` | `src/orchestration/setup/setup-machine.ts` | rename | proposal: shorter name |
| `src/contexts/framework/application/setup/setup-marketplace-source-use-case.ts` | `src/orchestration/setup/setup-marketplace-source.ts` | rename | stays with the interactive choice, uses `MarketplaceSourceMode` |
| `src/contexts/framework/application/setup/setup-tools-use-case.ts` | `src/orchestration/setup/setup-tools.ts` | rename | |
| `src/contexts/framework/application/setup/project-context-detector-use-case.ts` | `src/orchestration/setup/detect-project-context.ts` | rename | proposal: installation document maps `setup/**` to orchestration; read-only detection |
| `src/contexts/framework/application/global/update-tools-use-case.ts` | `src/orchestration/sync/for-each-category.ts` | merge | single fan-out mechanism with the two subclasses below |
| `src/contexts/framework/application/global/update-ai-tools-use-case.ts` | `src/orchestration/sync/for-each-category.ts` | merge | becomes one call with an argument |
| `src/contexts/framework/application/global/update-ide-tools-use-case.ts` | `src/orchestration/sync/for-each-category.ts` | merge | |
| `src/contexts/framework/application/global/update-one-tool-use-case.ts` | `src/orchestration/sync/update-one-tool.ts` | rename | error carried as `GlobalExecutionError` |
| `src/contexts/framework/application/global/resolve-update-decision-use-case.ts` | `src/orchestration/sync/resolve-update-decision.ts` | rename | proposal: conflict arbitration of the sync loop |
| `src/contexts/framework/application/global/restore-all-use-case.ts` | `src/orchestration/sync/restore-all.ts` | rename | |
| `src/contexts/framework/application/global/doctor-all-use-case.ts` | `src/orchestration/doctor/doctor-all.ts` | merge | no longer a class, uses the same fan-out |
| `src/contexts/framework/application/global/status-all-use-case.ts` | `src/orchestration/doctor/status-all.ts` | merge | same |
| `src/contexts/framework/application/doctor/doctor-use-case.ts` | `src/orchestration/doctor/run-doctor.ts` | rename | proposal: verb-first name |
| `src/contexts/framework/application/doctor/doctor-layout-use-case.ts` | `src/orchestration/doctor/check-layout.ts` | rename | proposal: verb-first name |
| `src/contexts/framework/application/doctor/doctor-merge-files-use-case.ts` | `src/orchestration/doctor/check-merge-files.ts` | rename | proposal |
| `src/contexts/framework/application/doctor/doctor-plugin-use-case.ts` | `src/orchestration/doctor/check-plugins.ts` | rename | proposal |
| `src/contexts/framework/application/doctor/doctor-references-use-case.ts` | `src/orchestration/doctor/check-references.ts` | rename | proposal |
| `src/contexts/framework/application/doctor/doctor-tracked-files-use-case.ts` | `src/orchestration/doctor/check-tracked-files.ts` | rename | proposal |
| `src/contexts/framework/application/doctor/doctor-registration-use-case.ts` | `src/contexts/host-registration/application/inspect-host-registration.ts`; `src/orchestration/doctor/check-registration.ts` | split | check in host-registration, aggregation in the scenario |
| `src/contexts/framework/application/clean-use-case.ts` | `src/orchestration/clean/clean-project.ts` | rename | host blocks replaced by `WithdrawFromHost`; proposal: name |
| `src/contexts/framework/application/clean/clean-user-scope-use-case.ts` | `src/orchestration/clean/clean-user-scope.ts`; `src/contexts/installation/application/purge-user-scope-files.ts` | split | host blocks replaced by `WithdrawFromHost`; allow-list purge to installation; proposal: installation file name |
| `src/contexts/framework/application/uninstall/uninstall-use-case.ts` | `src/orchestration/clean/uninstall.ts` | rename | |
| `src/contexts/framework/application/uninstall/uninstall-plugin-use-case.ts` | `src/orchestration/clean/uninstall-plugin.ts` | rename | |
| `src/contexts/framework/application/uninstall/uninstall-tools-use-case.ts` | `src/orchestration/clean/uninstall-tools.ts` | rename | |
| `src/contexts/framework/application/uninstall/uninstall-ide-use-case.ts` | `src/orchestration/clean/uninstall-ide.ts` | rename | |
