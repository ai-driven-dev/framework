# Review Fixes — Martin Pass 1

## Blockers

- [x] **B1** `commands/update.ts` — double manifest load, fallback masque l'erreur silencieusement

## Warnings

- [x] **W2** Extraire `resolveFrameworkWithFallback()` — `commands/restore.ts` + `commands/doctor.ts`
- [x] **W3** `SyncUseCase.execute()` — découper les 3 phases en méthodes privées
- [x] **W4** `architecture.md` — documenter la clé `tools` dans config
- [x] **W6** `RestoreUseCase` — garder le `save()` seulement si des changements ont eu lieu

## Suggestions

- [x] **S1** Tests — déplacer `OverwritePrompter`/`KeepPrompter` dans `helpers.ts`
- [x] **S2** `UpdateUseCase.execute()` — extraire diff / write / manifest rebuild en méthodes privées
- [x] **S3** `doctor-use-case.ts` — regex `/\.m(d|dc)$/` → `/\.(md|mdc)$/`

## Pass 3 — Bug Fixes (Alexia audit)

Bugs discovered via full interactive scenario testing (`temp/test-all.sh`, 57 scenarios):

- [x] **BUG-01** `restore`: showed "locally modified" message for deleted files. Fixed: `reason: "deleted" | "modified"` propagated through `toRestore[]` → `Prompter.resolveConflict(path, reason)`.
- [x] **BUG-02** `restore`: crashed without TTY (no `--force`). Fixed: TTY guard added in `commands/restore.ts` before prompter creation.
- [x] **BUG-04** `cache clear --all`: not supported. Fixed: `--all` option added with mutex validation against positional version arg.
- [x] **BUG-05** `config delete`: not implemented. Fixed: `SettingsRepository.delete(key)` added to port + adapter; `config delete <key>` subcommand added.
- [x] **BUG-06** `install`: auto-initialized on missing manifest (silent bad UX). Fixed: `ensure-initialized-use-case.ts` deleted; explicit guard added in `commands/install.ts` with error "No AIDD installation found. Run `aidd init` first."
- [x] **BUG-06 cascades**: 7 e2e test files called `install` without prior `init`. Fixed by Martin: each test now runs `init` first.
- ~~**BUG-03**~~ `doctor` not detecting missing files — CANCELLED: by design. Missing/modified files = drift → `status` command. Doctor checks structural integrity only.

## Pass 2 — Warnings restants

- [x] **P2-W1** `resolveFrameworkWithFallback` — ne court-circuite pas sur erreur `--framework` local
- ~~**P2-W2**~~ Double manifest load dans `update.ts`/`restore.ts` — accepté (trade-off architectural : le use case doit rester auto-suffisant, double load est idempotent et bon marché)
- ~~**P2-W3**~~ `SyncUseCase` context objects — accepté (pas de blocker, refacto coûteuse sans gain fonctionnel)
