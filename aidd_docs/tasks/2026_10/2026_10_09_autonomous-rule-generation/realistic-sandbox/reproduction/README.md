# Deterministic reproduction

Requires Node 24 or later and an already built framework CLI. These scripts make no model calls and never copy authentication. They install locally with the real CLI; host binaries are absent from the isolated installation PATH. Native plugin activation is not claimed. Cursor refuses project scope; supported flat translation is used for Cursor and as the bounded alternative for Codex/Copilot.

From the framework root:

```sh
node aidd_docs/tasks/2026_10/2026_10_09_autonomous-rule-generation/realistic-sandbox/reproduction/run.cjs --repo "$PWD" --smoke
```

`AIDD_REPO_ROOT` can replace `--repo`. The smoke run creates a fresh physical temporary root, runs the fixture's nine tests, installs OpenCode's plugin, executes its thirteen-step three-rule lifecycle, and checks doctor/sync/removal ownership. It writes exact commands and outputs into `reproduction-results.json` beneath the printed temporary root. An existing unrelated directory cannot be supplied as a run destination.

Omit `--smoke` to run all five hosts plus mixed targets, 78 lifecycle invocations, twelve multi-source refusal scenarios and cleanup. Individual stage scripts accept the printed owned temporary root as their first argument and an optional repository path as their second; their ownership marker must match the exact physical root before any cleanup. They refuse unowned roots rather than overwrite them.

The fixture contains a dependency-free invoice HTTP API, user guidance and real memory, and three user-native rules. Lifecycle requests cover all-files, domain TypeScript and documentation scopes, canonical edits, publication, retargeting and deletion. Existing user bytes must survive. The generated sources and AGENTS contribution are not plugin-owned and must survive plugin removal.

Historical exact command/results and the verified portable smoke run are recorded in `../deterministic-results.json`. Original absolute paths identify the historical run; the scripts themselves contain no personal source path. Natural model journeys and subscription credentials are deliberately outside this reproduction.
