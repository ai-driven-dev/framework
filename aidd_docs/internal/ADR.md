# Architecture Decision Record (ADR)

This file contains the key architectural decisions made during the project, along with their context and consequences.

## Decision Log

| Date       | ID      | Title                                                                                   | Consequences                                              |
| ---------- | ------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 2026-03-18 | DEC-001 | [AIDD signals based on frontmatter](./decisions/DEC-001-aidd-signals-frontmatter.md)   | init no longer blocks existing tool users                 |
| 2026-03-18 | DEC-002 | [Tool helpers in tool-config.ts](./decisions/DEC-002-tool-helpers-in-tool-config.md)   | single source for tool config logic, no shared.* files    |
| 2026-03-19 | DEC-003 | [signalDir on ToolConfig, hasToolSignals in domain](./decisions/DEC-003-signal-dir-in-tool-config.md) | signal detection shared between init and doctor via domain |
| 2026-03-19 | DEC-004 | [Doctor checks both directions manifest↔disk](./decisions/DEC-004-doctor-bidirectional-checks.md) | missing tracked files now surface as errors |
| 2026-03-22 | DEC-005 | [BannerUseCase with injected WriteStream](./decisions/DEC-005-banner-use-case-injected-stream.md) | testable banner without global stdout side-effects |
| 2026-03-22 | DEC-006 | [Shared skip signal for interruptible animations](./decisions/DEC-006-shared-skip-signal-animation.md) | any keypress skips entire animation instantly |
| 2026-03-22 | DEC-007 | [isFileTracked() as guard before writing untracked file](./decisions/DEC-007-isfiletracked-guard-before-write.md) | Manifest is canonical oracle for AIDD file ownership |
| 2026-03-22 | DEC-008 | [Skip untracked user files during install and update](./decisions/DEC-008-skip-untracked-user-files-on-install-update.md) | user files at colliding paths preserved unconditionally |
| 2026-03-24 | DEC-009 | [Remove init and adopt CLI commands](./decisions/DEC-009-remove-init-adopt-commands.md) | setup is sole entry point; hidden commands removed |
| 2026-03-24 | DEC-010 | [SetupUseCase non-interactive options](./decisions/DEC-010-setup-non-interactive-options.md) | programmatic use without prompter mocking |
| 2026-03-24 | DEC-011 | [ResolveFrameworkUseCase and RequireAuthUseCase](./decisions/DEC-011-resolve-framework-require-auth-use-cases.md) | plain functions replaced by classes; auth delegated, no duplication |
| 2026-03-24 | DEC-012 | [ConfigHandler.resolveOutputPath for runtime path resolution](./decisions/DEC-012-config-handler-resolve-output-path.md) | generateDistribution async; use cases stay tool-agnostic |
| 2026-03-28 | DEC-013 | [Recursive MenuNode tree for interactive TUI](./decisions/DEC-013-recursive-menu-node-tree.md) | any new submenu = add children; no navigation code change |
| 2026-03-28 | DEC-014 | [string[] breadcrumb as menu loop state](./decisions/DEC-014-breadcrumb-string-array-menu-state.md) | returnTo scales to any depth; UX resumes at correct level |
| 2026-03-28 | DEC-015 | [createMenuDeps() + Map memoization for createDeps](./decisions/DEC-015-create-menu-deps-map-memoization.md) | E2E test isolation fixed; no double I/O in production |
| 2026-04-06 | DEC-016 | [ConfigHandler.mergeStrategy() replaces boolean shouldMerge](./decisions/DEC-016-config-handler-merge-strategy.md) | MCP config files are user-prime; user customizations survive update |
| 2026-04-08 | DEC-017 | [ErrorHandler replaces CLIOutput.exit()](./decisions/DEC-017-error-handler-replaces-cli-output-exit.md) | CLIOutput is pure output; all commands use errorHandler.handle() |
| 2026-04-08 | DEC-018 | [Typed exceptions across three layers](./decisions/DEC-018-typed-exceptions-three-layers.md) | Zero throw new Error(); infra errors never cross port boundary |
| 2026-04-09 | DEC-019 | [ConfigHandler.entrySection() for per-entry tracking](./decisions/DEC-019-config-handler-entry-section.md) | Tools own section key mapping; use-cases stay tool-agnostic |
| 2026-04-09 | DEC-020 | [No manifest version bump for mergeFiles](./decisions/DEC-020-no-manifest-version-bump.md) | Backward-compatible; old manifests load with empty mergeFiles |
| 2026-04-10 | DEC-021 | [JSONC stripping in domain extractMergeEntries](./decisions/DEC-021-jsonc-stripping-in-domain.md) | Domain self-contained; ~40 lines duplication with adapter |
