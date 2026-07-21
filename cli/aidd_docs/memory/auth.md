# Auth

How identity and access work. There are no user accounts: a single GitHub token gates access to remote marketplaces and plugin sources.

## Authentication

- Commands: `aidd auth login [--gh] [--token <v>] [--level user|project]`, `auth logout`, `auth status` (`application/commands/auth.ts`).
- Method per stored config: `stored` (a PAT written to `auth.json`) or `external` (resolved fresh from `gh auth token` at read time).
- Resolution order (`infrastructure/adapters/auth-reader-adapter.ts`), first hit wins:
  1. `AIDD_TOKEN` env
  2. project `<root>/.aidd/auth.json`
  3. user `~/.config/aidd/auth.json`
  4. none → `null`
- Storage (`infrastructure/auth/auth-storage.ts`): user path `~/.config/aidd/auth.json` (dir overridable via env), project path `<root>/.aidd/auth.json`. Shape `{ method, token?, level }`.

## Authorization

- No roles, scopes, or RBAC. Token presence is the only gate — it authorizes remote marketplace/framework fetches.
- `RequireAuthUseCase` throws when a command needs a token and none resolves; surfaced at the command layer.

## Sessions

- No sessions, no refresh. A `stored` token persists in `auth.json` until `auth logout` clears it. An `external` (`gh`) token is resolved fresh on each read.
