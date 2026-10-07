---
status: in-progress
---

# Instruction: prove current host source

## Outcome

For Codex/Copilot, read the effective host catalogue source before add, refresh, update, project removal, or project/user clean. An AIDD machine claim alone cannot authorize a mutation when the source has been repointed. Before unregistering even an owned catalogue, prove its full host ref list contains no foreign ref. Fresh absence permits registration; an unreadable or foreign source refuses with a named manual remedy. Record exact source only after a proven fresh add. No legacy claim inference.

Apply this gate to project plugin removal even when an old manifest lacks a native registration, if that removal would reach the host. Project clean may still detach a shared user-scope claim and clean local state without catalogue proof, because it must not mutate that shared catalogue. An unproven plugin ref is left enabled rather than uninstalled. [Copilot repository `enabledPlugins` is declarative auto-install](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference), so even writing settings is an activation side effect: defer that projection until the catalogue and plugin ref are proven and activated.

Before `clean --scope user`, map every canonical machine claim to exactly one registered host catalogue with current source/ref proof. An orphan or ambiguous claim cannot be uninstalled through a different proven catalogue. A machine-global ref without a canonical claim is likewise not exclusive to this project, even if its host source is AIDD-owned.

User clean preflights availability of every native activator it will need before uninstalling the first tool. A known missing second binary must not leave the first tool already changed while machine claims still record the old state.

Codex 0.151.0 exposes `marketplace list --json` with `name`, `root`, and `marketplaceSource`. The installed Copilot 1.0.83 refuses `--json` despite current official docs; its repository overlay can replace the user source. Do not parse human text as an ownership proof. Feature-probe structured output and fail closed on unsupported versions until an exact source witness can be measured.

## Verification

- A/B fresh registration works; a foreign same-name source and cache stay byte-identical through sync/update/remove/clean.
- Copilot activation refusal leaves foreign repository settings, including `extraKnownMarketplaces` and `enabledPlugins`, byte-identical.
- Native CLI readers and source parsing use installed binary/official contracts, fail closed on unknown shapes.
- User clean refuses an orphan `x@B` claim when only catalogue A is proven; project clean never uninstalls an unclaimed machine-global ref used manually by B.
- Multi-tool user clean with the second binary unavailable refuses before the first host catalogue or ref changes.
- Full tests, architecture, build, smoke, targeted destructive mutants, then all declared mutation scopes.
