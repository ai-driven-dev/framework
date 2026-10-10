# OpenCode V2 runtime verification

## Environment
- Isolated official @opencode/cli 2.0.22 at `/tmp/aidd-953-runtime-ryTstm/v2/node_modules/.bin/opencode2`.
- A loopback-only OpenAI-compatible model server returns deterministic text and captures requests. No paid inference is used.
- A fresh temporary project and relocated HOME, USERPROFILE and XDG directories isolate the host from the user's profile.
- Observed host platform: Darwin arm64. The V2 startup log reports version=2.0.22.
- Probe source and request captures: `/tmp/aidd-913-runtime-NAuUNo/`.
- Windows and Linux runtime behavior has not been exercised by this manual probe.

## Before the change
The project contains user text in AGENTS.md, a rule under .opencode/rules/01-standards/1-probe.md, and a separate file referenced only by config.instructions.

Command:
```sh
python3 /tmp/aidd-913-runtime-NAuUNo/runtime_probe.py \
  /tmp/aidd-913-runtime-NAuUNo/project \
  /tmp/aidd-913-runtime-NAuUNo/baseline \
  --present AIDD913_USER_CONTEXT \
  --absent AIDD913_RULE_ONE \
  --absent AIDD913_INERT_CONFIG_ONLY
```

Observed: exit 0, two captured model requests. The user marker is present; the modular rule and instructions-only marker are absent. This reproduces the discovery failure against the real V2 runtime before implementation.

## Candidate
The built candidate publishes sources through:
```sh
node cli/dist/cli.js framework rules --tool opencode --publish
```

For direct generation, prospective content is staged outside the target and supplied to the same operation:
```sh
node cli/dist/cli.js framework rules --tool opencode --publish \
  --write .opencode/rules/01-standards/2-staged.md \
  --from /tmp/aidd-913-runtime-NAuUNo/write-staged.md
```

Observed results are retained in [runtime-results.json](./runtime-results.json):
- Publication: exit 0; two model requests; exact source-rule and user markers present; instructions-only marker absent.
- Rerun: exit 0; AGENTS.md is byte-identical; each rule marker appears once.
- Direct generation: the staged file and active text are written; a real V2 run receives both exact source-rule markers and user guidance.
- Source update: exit 0; a real V2 run receives the new marker and no longer receives the old marker.
- User-edited owned block: the built CLI exits 1 with an actionable refusal; every project file outside .git is byte-identical before and after, including the prospective rule's old content.
- Last-source deletion: two successful deletes remove only the active rule block; AGENTS.md equals its original user-authored bytes. A real V2 run receives user guidance and no removed-rule markers.
- All five real runtime journeys exit 0 and capture two model requests. All five built-CLI assertions pass. Each publication operation preserves opencode.json bytes; the probe itself changes only its loopback server address between host runs.

Raw captures and reproducible Python probes remain under `/tmp/aidd-913-runtime-NAuUNo/`; the checked-in results retain command arguments, exits, presence/absence assertions and content hashes. These witnesses cover Darwin arm64 with OpenCode 2.0.22. They do not claim Windows, Linux or other V2 releases have been runtime-tested.

## Repaired candidate
The independent review exposed a frontmatter fence that disappeared during rendering, allowing an invalid contribution on the first write. The repaired built CLI rejects that exact payload on its first `--write`, exits 1 with `Unclosed Markdown fence`, and preserves every project file byte, including AGENTS.md and config. A separate valid staged write exits 0. Both commands and the tested binary SHA-256 are retained under `cli.final-repaired` in runtime-results.json; the reproducer is `/tmp/aidd-913-runtime-NAuUNo/final_cli.py`.

A fresh real V2 run against that valid publication exits 0 and captures two model requests containing both `AIDD913_FINAL_RULE` and `AIDD913_USER_CONTEXT`, while excluding `AIDD913_INERT_CONFIG_ONLY`. The final repaired runtime summary is retained under `runtime.final-repaired`. The source validation repair leaves normal rendered instruction text unchanged.
