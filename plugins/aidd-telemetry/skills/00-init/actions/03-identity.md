# 03 - Identity

Let the person choose to be named on their own measurement, or stop being named.

## Input

What the person wants: to be named as an identifier they give, to see the current choice, or to be named no more.

## Process

1. Say that the local report name is optional, labels the person axis of their own report, and is kept on this machine. It is not the provider identity, the installation UUID, or a Gouvernail login.
2. Run `aidd telemetry identity` to read the current choice, and tell the person what it holds.
3. To set one, ask the person for the identifier they want and wait for it. Run `aidd telemetry identity <id>` with exactly that text.
   - The command refuses an identifier that is empty, over 128 characters, or spans lines: show its message and stop.
4. To remove it, confirm that the person wants to be named no more, then run `aidd telemetry identity --off`.
5. Run `aidd telemetry identity` again after a change and check that it reports the requested identifier or its removal. Present the result in the table below; fill provider, endpoint and dates only when a relevant CLI command actually reports them. Do not infer an identity or expose credentials.

## Output

| Item | Tools | Endpoint | Created | Stored |
| --- | --- | --- | --- | --- |
| Local report name | Claude Code and Codex local report; not tool-specific | None | Not recorded by this command | `~/.config/aidd/telemetry/identity.json` by default |
| Installation UUID | Installation, not a person | Not currently sent | Not reported by this command | `~/.config/aidd/installation/id.json` by default |
| Provider identity | Provider and values only if verified | Dev destination only if verified; prod unavailable | Not reported by this command | Local OTLP capture if emitted; provider storage unknown |

Show the local name or `anonymous` as reported. Paths may differ with the configured user directory. A provider's native identity can be forwarded to local Gouvernail even when the local report is anonymous. Production user identity is a future requirement, not implemented today.
