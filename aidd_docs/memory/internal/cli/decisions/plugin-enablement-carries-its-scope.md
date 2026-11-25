# Plugin enablement carries its own scope

Read before touching `HostActions`, `plugin remove` or `clean`'s uninstall.

- `HostActions.enablePlugin` and `uninstallPlugin` take an optional `Scope`, default `"project"`.
- It is separate from a registration's own `scope`, always `"user"` for the shared source.
- It decides Claude's `--scope local` (project-bound) or `--scope user` (machine-wide).
- Without it, every Claude enablement landed at Claude's implicit `user` default.
- A tool without `scopeArgs` (Codex, Copilot) is unaffected.
- `clean` and `plugin remove` read the scope to uninstall from the host's registry first (`cli/src/contexts/host-registration/ports/host-plugin-registry.ts`).
- When the registry is silent: the manifest's recorded scope, then the other (`cli/src/contexts/host-registration/application/withdraw/uninstall-scope-order.ts`).
- Measured on the real `claude`: a mismatched-scope uninstall is refused, never silently missed.
