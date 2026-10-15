# What the previous telemetry left on disk

Recorded from the tree before phase 1 deleted it (`cli/src/...`, line numbers are of that tree, recoverable from the parent of the phase-1 commit). Input for phase 8 (`on` cleans, `forget` removes).

## Sink directory (day files)

Source: `contexts/telemetry/infrastructure/telemetry-sink-adapter.ts`.

- Resolution (`:101-104`): `named = process.env.AIDD_TELEMETRY_DIR`; `legacy = userConfigDir ?? process.env.AIDD_USER_CONFIG_DIR`; `rootDir = named ?? join(legacy ?? defaultConfigDir(), "telemetry")`.
- `defaultConfigDir()` (`:55-64`): not win32 -> `join(resolveHomeDir(), ".config", "aidd")` (`legacyConfigDir`, `:44-46`); win32 -> legacy dir when `<legacy>/telemetry/*.jsonl` exists, else `join(process.env.APPDATA, "aidd")`, else legacy dir.
- Files: one per UTC day, `YYYY-MM-DD.jsonl` (`DAY_FILE_EXTENSION = ".jsonl"` `:21`, `dayKey` = `at.toISOString().slice(0, 10)` `:27-29`), appended. Modes `0o600` file, `0o700` dir (`:22-23`) unless the location was user-named.
- `AIDD_USER_CONFIG_DIR` also relocates `auth.json`, `marketplaces.json`, `references.json` (`user-manifest-repository-adapter.ts:14`).

## Identity

Source: `contexts/telemetry/infrastructure/person-identity-adapter.ts:59`, `kernel/reading/home-dir.ts:22-27`.

- File: `join(resolveAiddConfigDir(), "identity.json")`.
- `resolveAiddConfigDir()`: win32 with `APPDATA` -> `%APPDATA%\aidd`; otherwise `~/.config/aidd`. Never `AIDD_USER_CONFIG_DIR`.
- Shape (`person-identity-adapter.ts:41-48`): `{ person_id, origin: "minted" | "adopted", display_name?, also_me?: string[] }`, pretty JSON + newline.

## Commit trailer delegate

Source: `contexts/telemetry/domain/formats/commit-session-trailer.ts`.

- Trailer token (`:11`): `AIDD-Session-Id`, written as `--trailer "AIDD-Session-Id=$session_id"`; session id = `${CODEX_THREAD_ID:-${CLAUDE_CODE_SESSION_ID:-}}`.
- Delegate file name (`:15`): `aidd-session-trailer.sh`; header `#!/bin/sh` (`:21`); second line `# Installed by \`aidd telemetry on\`, removed by \`aidd telemetry off\`.` (`:83`).
- Delegate directory (`runtime/git/git-adapter.ts:242-249`): no manager -> `git rev-parse --git-path hooks`; under lefthook/husky -> `<git rev-parse --git-common-dir>/hooks`.
- Hook line appended to `prepare-commit-msg` (`:26-28`): `sh "<delegatePath with / separators>" "$@"`. The hook file is `prepare-commit-msg` (`git-adapter.ts:24`), made executable.
- Lefthook snippet (`:42-49`), added to `lefthook.yml` under `prepare-commit-msg:`:

```yaml
prepare-commit-msg:
  commands:
    aidd-session-trailer:
      run: |
        delegate="$(git rev-parse --git-common-dir)/hooks/aidd-session-trailer.sh"
        if [ -f "$delegate" ]; then sh "$delegate" {1} {2}; fi
```

- Husky line (`:53-56`), in `.husky/prepare-commit-msg`:

```sh
delegate="$(git rev-parse --git-common-dir)/hooks/aidd-session-trailer.sh"
[ -f "$delegate" ] && sh "$delegate" "$@"
```

- Manager detection (`telemetry-setup.ts:176-190`): `lefthook.yml`, `lefthook.yaml`, `.lefthook.yml`, `.lefthook.yaml` -> lefthook (wins ties); `.husky` -> husky. Under a manager the CLI never edited the manager's config; it printed the snippet.

## Run journal

Source: `kernel/paths.ts:14-31`.

- Directory: `aidd_docs/runs/` at the repository root above the project (`DOCS_DIR = "aidd_docs"`, `RUNS_SUBDIR = "runs"`); `AIDD_RUNS_DIR` overrides it outright.
- `RUNS_ENTRY` (`:22`) = `aidd_docs/runs/`, the `.gitignore` line `telemetry on` added (via `GitignoreUseCase`) and `manifest-gitignore-entries.ts:13` added to the managed set `[".aidd/cache/", RUNS_ENTRY, ...]`.
- Unrecognised-file quarantine name (`telemetry-evidence-adapter.ts:34`): `_unrecognised.jsonl`, inside the runs directory.

## `.aidd/config.json`

Source: `contexts/telemetry/domain/telemetry-switch.ts`.

- Key `telemetry` (`:11-58`): `{ "enabled": boolean, "endpoint"?: string }`. `endpoint` was written by a since-removed `telemetry endpoint` command; `on` and `off` preserved it verbatim, nothing read it.
- Refusal variable (`:23`): `AIDD_TELEMETRY`; only the literal `"0"` refuses.
- The new version treats a bare `enabled: true` (no `version: 2`) as not opted in.

## Claude Code settings export leftovers

Source: `contexts/telemetry/domain/telemetry-export-leftover.ts:7-15`. `env` keys the removed `telemetry endpoint` wrote into a Claude Code settings file: `CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_METRIC_EXPORT_INTERVAL`, `OTEL_RESOURCE_ATTRIBUTES`.
