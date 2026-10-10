# Phase 4 evidence inventory

- `caller-receipt.json`, `generation-validation.json`, `generated-artifact-hashes.txt`, `source-contract-hashes.txt`: caller generation, structural validation and provenance.
- `generated-project/`: exact generated Kilo agent, workflow and payload fixture.
- `replay-kilo.sh`, `extract-free-model.cjs`: reproducible isolated replay and compact free-model catalog extraction.
- `attempt-02-dns-timeout/`, `attempt-03-replay/`: separate records for actual failed workflow replays inside the Codex sandbox, including outputs, exit codes and before/after hashes. Both failures are `getaddrinfo ETIMEOUT api.kilo.ai`.
- `attempt-04-outside-sandbox/`: successful Kilo 7.8.8 Linux runtime after explicit authorization to run outside the sandbox. Sanitized JSONL proves workflow invocation, subagent resolution, completed payload read, exact result and zero cost; before/after artifact hashes match.
- `historical-session-export/`: original sanitized exports from an earlier successful execution. They retain completed workflow/subagent/read statuses and zero cost, but hide the payload path/content and exact response. That earlier top-level JSONL was overwritten; the separately archived successful attempt 04 now closes the exact-output evidence gap.

No successful trace has been reconstructed. See [runtime report](../../phase-4-runtime.md) for what the archived evidence does and does not establish.
