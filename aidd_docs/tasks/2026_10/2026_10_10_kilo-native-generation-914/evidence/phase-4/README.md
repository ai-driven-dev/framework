# Phase 4 evidence inventory

- `caller-receipt.json`, `generation-validation.json`, `generated-artifact-hashes.txt`, `source-contract-hashes.txt`: synthetic caller inputs, structural validation and provenance.
- `generated-project/`: exact generated Kilo agent, workflow and payload fixture.
- `replay-kilo.sh`, `extract-free-model.cjs`, `validate-generation.cjs`: isolated replay, compact free-model catalog extraction and fixture validation.
- `attempt-04-outside-sandbox/`: retained successful workflow JSONL and exit code, selected free-model catalog entry, and artifact hashes before and after Kilo consumed the fixture. This is historical evidence from the original authorized run.

Two earlier sandbox runs were historically reported as DNS timeouts. Their detailed logs were removed; they are not replay evidence. Historical sanitized session exports were also removed because their redaction markers retained technical session/message/part identifiers. No separate external copy of original export bytes or their SHA-256 hashes was found during the audit. The local B1 backup is described in the phase 1 report as pre-cleanup modified working state, not a distinct set of raw original exports; the B1 backup itself was not independently available for verification in this repository. No successful trace was reconstructed from the historical exports; the original successful attempt 04 JSONL remains separately archived.

The replay script masks the current `$HOME`, runtime project and XDG paths in captured output using literal path replacement, so shell-special characters in those paths are safe. Temporary directories use `$TMPDIR` when set and `/tmp` otherwise. This only removes a fixed `/home/coder` assumption; it does not establish macOS or Windows compatibility. The updated script has not been rerun. The historical attempt 04 output predates that script edit.

For a future replay, use a fresh attempt name, for example:

```sh
bash aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914/evidence/phase-4/replay-kilo.sh attempt-post-cleanup
```

The script requires Bash, Git metadata, Node, `sha256sum`, `mktemp`, `sed` (for session selection), an available Kilo CLI with working network/model access, and a catalog entry for the explicitly selected free model. It writes output into the named directory. This command was not run during the cleanup.
