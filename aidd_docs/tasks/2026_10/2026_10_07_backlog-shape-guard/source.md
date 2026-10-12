## Description

`cli/tests/contexts/telemetry/infrastructure/task-backlog-skill-shape.integration.test.ts` reads two plugin files and feeds each one's taught `backlog-link.json` example through the real `TaskBacklogAdapter`. Nothing runs it when only those plugin files change.

- `lefthook.yml`'s pre-push jobs `cli-knip` and `cli-test` both carry `glob: "cli/**"`.
- `cli-ci.yml`'s `changes` job matches `cli/*|kanban/*|scripts/__tests__/*|README.md`, plus `plugins/aidd-telemetry/*` excluding prose. `plugins/aidd-pm/**` matches nothing.

So a change confined to the plugin files that test reads breaks it, and neither the local gate nor CI runs it.

The sibling guard `scripts/__tests__/a-backlog-link-the-reader-can-read.test.js` does run on such a change: `scripts-tests` carries `glob: "{scripts,plugins,cli/src}/**"`. But it asserts only that each field name appears as a substring (`text.includes('"backlog"')`). It never parses the example. The case that falls between the two guards: the taught example stops being valid JSON, or moves, while still containing the three strings.

## Affected file(s)

`scripts/__tests__/a-backlog-link-the-reader-can-read.test.js`

## Expected behaviour

A change confined to the plugin files that teach `backlog-link.json` fails locally, at pre-commit, when it breaks what the reader accepts. The structural assertions belong in the guard that already runs on `plugins/**`: parse the taught example and require the three fields as non-empty strings.

## Observed behaviour

Measured in PR #969. The taught shape moved from a fenced block in `actions/01-build.md` to `assets/backlog-link-template.json`. The `scripts/` guard failed at pre-commit on the field names, which is correct. The `cli/` test failed too, with `expected null not to be null` and `no fenced json example to test` — but only in CI, and only incidentally: that same push also touched `scripts/__tests__/`, which is in the CI filter. A push carrying the plugin change alone would have landed a red test on `next`.

## AI tool

Claude Code

## OS

macOS

## Additional context

Widening either filter to `plugins/**` is the wrong fix: it runs the full 6800-test cli suite on every prose edit. The narrow alternative, listing the two paths the test reads, is the hand-maintained duplication that produced this — those paths just moved.

The `cli/` test keeps its own job, crossing the boundary into the real adapter, which a repository script test cannot do.
