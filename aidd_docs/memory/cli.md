# CLI

The `aidd` command-line tool: its command surface, I/O conventions, and distribution.

## Commands

Grouped surface (39 leaf commands). Authoritative list + flags in `project-brief.md`; live help is the source of truth (`aidd --help`, `aidd <group> --help`).

- **Top-level**: `setup`, `status`, `update`, `sync`, `restore`, `doctor`, `clean`, `self-update`
- **`ai <tool>`**: install / uninstall / list / status / update / sync / restore / doctor
- **`ide <tool>`**: install / uninstall / list / status / update / doctor
- **`plugin`**: install / create / remove / list / update / search / doctor
- **`marketplace`**: add / list / remove / refresh / check
- **`auth`**: login / logout / status (see `auth.md`)
- **`framework build`**: maintainer/authoring only — not part of the consumer flow

## Interface

- Parser: `commander` (`src/cli.ts`). `preAction` hook builds the dep graph once per `projectRoot` (memoized).
- Global flags: `--version`, `--verbose`. Interactive by default (`@inquirer/prompts`).
- Non-TTY needs explicit flags (`--yes`, `ai sync --source <tool>`, …). Top-level `sync` is interactive-only: non-TTY → exit 1 with guidance to use `aidd ai sync`.
- Output: text on stdout, errors on stderr via `application/output.ts`. Typed exceptions thrown inward, caught only at the command layer (`error-handler.ts`) — no silent failures.
- Exit codes: `0` ok; `1` on error, unhealthy `doctor`, or a non-interactive guard.

## Distribution

- npm bin `aidd` → `dist/cli.js` (`package.json` `bin`). Single ESM bundle (tsup); all assets inlined at build time, no fs reads at runtime.
- Run via `npx @ai-driven-dev/cli@latest <cmd>` (zero-install) or global install. Node.js >= 24.
- Published to public npm **and** GitHub Packages — see `deployment.md`.
