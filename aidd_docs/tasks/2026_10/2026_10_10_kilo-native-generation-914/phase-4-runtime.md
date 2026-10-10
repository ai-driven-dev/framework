# #914 — Runtime phase 4

## Reproduction and successful run

The evidence was produced with the existing replay script, executed outside the Codex sandbox after explicit user authorization:

```sh
bash aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914/evidence/phase-4/replay-kilo.sh attempt-04-outside-sandbox
```

The script copies the caller-generated fixture to a fresh `/tmp` project, assigns fresh temporary `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME` and `XDG_CACHE_HOME`, and removes both temporary roots on exit. Kilo 7.8.8 ran with `--pure`; the workflow explicitly selects `kilo/cohere/north-mini-code:free`, with no fallback. Catalog metadata labels the model free and reports zero input/output/cache cost.

`attempt-04-outside-sandbox/` archives command outputs, stderr, exit codes, sanitized JSONL and session exports. Exit codes: Kilo version 0; model catalog 0; agent debug 0; main workflow 0; main/subagent exports 0. The JSONL proves:

- `verify-workflow` invoked task `verify-agent`; task status completed and the subtask result was `AGENT_APPLIED:willow-5836`.
- A completed `read` event accessed `$RUNTIME_PROJECT/.kilo/agents/assets/agent-payload.txt`; its observed content was `AGENT_APPLIED:willow-5836`.
- The final response contained that exact payload. All recorded Kilo step costs were 0.
- Artifact hashes before and after the runtime match the generation receipt for agent, payload and workflow; Kilo left all three unchanged.

The transcript sanitizer removes session identifiers, workspace paths and model reasoning while retaining the task result, read path/content, final response and statuses. Session exports use Kilo's `--sanitize` option and corroborate the `verify-agent` session/read event.

## DNS diagnosis

The two earlier runs in `attempt-02-dns-timeout/` and `attempt-03-replay/` failed inside the Codex sandbox with `getaddrinfo ETIMEOUT api.kilo.ai`, exit 1. The same `getent` and `curl` probes failed inside the sandbox but succeeded outside it: DNS resolved, TLS verification passed and the endpoint returned HTTP 307. The successful runtime replay outside the sandbox confirms the earlier failure was sandbox network/DNS isolation, not Kilo configuration or the temporary XDG setup. No network or global configuration was changed.

## Generation and artifact provenance

`evidence/phase-4/caller-receipt.json` records generation by the current Codex caller following the installed `aidd-context` router and phase-4 capture/write/validate actions at HEAD `19c81c4f`. Inputs are explicitly synthetic, not interactive user answers. `generation-validation.json` records YAML, canonical path, allowed fields and body validation. `source-contract-hashes.txt` records the candidate sources; `generated-artifact-hashes.txt` records the generated artifacts.

`generated-project/` is the exact generated fixture: `.kilo/agents/verify-agent.md`, its bundled payload, and `.kilo/commands/verify-workflow.md`. The payload SHA-256 is `55630dd7c27452fb05892541f2cf1c2f0748853417b1bbe00c5e4345243bad6e`. The large full model catalog is not duplicated; the selected free entry is preserved as filtered stdout. See the [evidence inventory](evidence/phase-4/README.md).

## Scope and limits

No authenticated Claude runtime, OpenCode runtime, or Kilo runtime on macOS/Windows is claimed. Offline regressions are not substitutes for those runtimes. This evidence validates phase 4's agent/workflow Kilo runtime on Linux only; it does not close cross-platform AC15.
