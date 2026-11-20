---
status: pending
---

# Instruction: Artifact hook, its generated copies, aidd-dev and aidd-pm wired

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── scripts/
│   ├── check/
│   │   ├── run.cjs ✏️
│   │   └── engine/
│   │       ├── hook.cjs ✅
│   │       └── sync.cjs ✏️
│   └── __tests__/
│       ├── artifact-hook.test.js ✅
│       └── check/
│           ├── run.test.js ✏️
│           └── sync.test.js ✏️
└── plugins/
    ├── aidd-context/hooks/
    │   ├── artifacts.cjs ✅
    │   └── lib/contracts/ ✅
    ├── aidd-dev/hooks/
    │   ├── hooks.json ✅
    │   ├── artifacts.cjs ✅
    │   └── lib/
    │       ├── host.cjs ✅
    │       └── contracts/ ✅
    └── aidd-pm/hooks/
        ├── hooks.json ✅
        ├── artifacts.cjs ✅
        └── lib/
            ├── host.cjs ✅
            └── contracts/ ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | `artifact-hook.test.js` copies a plugin's generated `hooks/` to a temp folder, swaps `lib/host.cjs` per host (claude, codex, copilot, cursor, bridge stamped opencode and kilo, as `memory-hook.test.js:37-50` does), sets `TMPDIR` per test, and builds a temp project | hook installed per host | system |
| Happy path | PostToolUse writing `aidd_docs/tasks/x/phase-1.md` that breaks PLAN-02, then Stop | one continue answer in the host's shape, each line `aidd_docs/tasks/x/phase-1.md:<n> PLAN-02 <fix>` | system |
| Happy path | same flow for a story under `aidd_docs/backlog/stories/` and a `run.md` | STORY and IMPLEMENT findings answered | system |
| Edge case | conforming artifact, a file no `scope` claims, a phase file with no `plan.md` above it inside `aidd_docs/`, or Stop with no PostToolUse | stdout empty, exit 0 | system |
| Edge case | a file in scope broken on disk but never named by a PostToolUse | not reported | system |
| Edge case | a write to `plugins/aidd-dev/skills/01-plan/assets/plan-template.md` or to a `hooks/lib/contracts/**` copy | not judged, stdout empty | system |
| Edge case | SessionStart, then a shell PostToolUse (no `files`), then Stop. A broken story under `aidd_docs/backlog/stories/` has its mtime set after the reference with `fs.utimesSync` | the STORY finding is answered | system |
| Edge case | same flow, the broken file's mtime set before the reference | silent | system |
| Edge case | a broken file written by Write and touched after the reference by the same turn's shell | reported once | system |
| Edge case | no SessionStart (no `.ref`), shell PostToolUse, then Stop | silent, no folder walk | system |
| Edge case | Stop with `stop_hook_active` (Cursor `loop_count > 0`) | silent, mark consumed | system |
| Edge case | a copied `contract.json` made invalid | exactly one line naming the contract, exit 0 | system |
| Edge case | garbage stdin, unknown event, unwritable `TMPDIR` | silent, exit 0 | system |
| Edge case | a contract or template edited in a skill, copies not regenerated | `sync.cjs --check` and `run.cjs` (full, and scoped on that file) name the stale copy, exit 1 | cli |
| Edge case | the mark folder is not 0700 or not owned by the user | nothing written or read there | system |
| Teardown | temp projects, hook installs and `TMPDIR` folders removed | none left | system |

## Tasks to do

### `1)` One handler source

> The hook judges what the turn wrote, by the contracts it carries.

1. Write `scripts/check/engine/hook.cjs`: CommonJS, built-ins only, `require("./lib/host.cjs")` literally (REPO-06 regex `hook-rule-copies.cjs:45`), goals `start`, `mark` and `check`.
2. `start` (SessionStart): create the state folder `os.tmpdir()/aidd-hooks-<uid>/<plugin>/` (0700, owner-checked) and write `<sessionId>.ref` with the current time. Lift this from `plugins/aidd-ui/hooks/lib/hook.cjs:27-115`. The plugin name is read from the folder above `hooks/`.
3. `mark` (PostToolUse): add the `event.files` under `event.cwd` that some contract under `./lib/contracts/*/scripts/contract.json` could claim to `<sessionId>`. When `files` is empty and `command` is set, add only `shell`, no time. Write via temp file and rename.
4. Export `atStop(event)`: resolve the mark without creating any folder, read it, delete it, and sweep state older than 24 h. When the mark says `shell` and a `.ref` exists, list the files under each contract's `scope` globs whose mtime is after the reference, and add them to the written files, deduped. Expand each glob segment by segment from its static prefix: `*` reads one folder, `**` walks only below the prefix, skipping `.git` and `node_modules`; never the whole project. Rewrite `.ref` with the current time when the state folder exists. Return `""` when there is no mark or `event.stopActive` is set.
5. Load each contract with its own `scripts/lib/engine.cjs`. A `ContractError` becomes one line `<contract>: <message>`.
6. Unit per written file: a file unit matches a `scope` glob. A folder unit is the nearest ancestor up to the project root that matches a `scope` glob and holds `contract.marker`, tested before `check()` so a missing marker skips instead of throwing (`engine.cjs:91`). Run every contract that claims the unit, so plan and implement both run on a plan folder.
7. Keep findings on written files only, formatted `<project-relative file>:<line> <ID> <fix>`.
8. `check` (Stop): `host.continueTurn(atStop(event))`. The whole run sits in try/catch and exits 0.

### `2)` Generation and staleness in `sync.cjs`

> Every copy the hook needs is generated, and a stale one fails the repo check.

1. For each plugin with a skill contract holding `scope`, write `hooks/artifacts.cjs` from `hook.cjs`. Under `hooks/lib/contracts/<skill>/`, copy `scripts/contract.json`, `scripts/lib/*`, `scripts/custom/**`, and every file a rule's `template` or `schema` names, relative to the contract.
2. Name, and on write delete, any file under `hooks/lib/contracts/` with no source. `--check` names every stale path, exit 1.
3. Widen `ENGINE_PATH` (`run.cjs:40`) to `plugins/*/skills/*/{scripts,assets}/`, `plugins/*/hooks/artifacts.cjs` and `plugins/*/hooks/lib/contracts/`, so lefthook's scoped `run.cjs --fix {staged_files}` (`lefthook.yml:9`) catches them.
4. Run `node scripts/check/engine/sync.cjs` to generate the three plugins' copies.

### `3)` aidd-dev and aidd-pm wired

> Both plugins run the hook on their own.

1. Copy `cli/assets/hooks-runtime/host-claude.cjs` to `plugins/aidd-dev/hooks/lib/host.cjs` and `plugins/aidd-pm/hooks/lib/host.cjs`.
2. Write each `hooks/hooks.json` with three entries. SessionStart runs `node ${CLAUDE_PLUGIN_ROOT}/hooks/artifacts.cjs start`. PostToolUse, matcher `Write|Edit|Bash|Shell|bash|PowerShell` (as aidd-ui's), runs `... artifacts.cjs mark`. Stop runs `... artifacts.cjs check`. Each has timeout 5 and a status message such as `AIDD Dev: check written artifacts` or `AIDD PM: check written artifacts`.

### `4)` Tests prove the done-when without a host

> Each Test Scope row is an assertion.

1. Write `scripts/__tests__/artifact-hook.test.js` from the Test Scope, using the captured payload shapes in `scripts/__tests__/fixtures/hook-payloads/`.
2. Extend `scripts/__tests__/check/sync.test.js` (hook copies written, stale named, orphan named) and `run.test.js` (scoped run on a skill template or contract reports a stale hook copy).
3. Time a Stop on a written `run.md` in a git repo with many commits, and a shell-marked Stop over a large `aidd_docs/` tree, against the 5 s timeout (ARCHITECTURE hooks rule 5).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | a PostToolUse then Stop on a broken phase file returns its PLAN findings in each host's continue shape; a shell-marked turn reports only the in-scope files modified after the reference time; every silent row of the Test Scope prints nothing and exits 0 |
| 2 | after editing `plugins/aidd-dev/skills/01-plan/assets/phase-template.md`, `sync.cjs --check` and `run.cjs` exit 1 naming `plugins/aidd-dev/hooks/lib/contracts/01-plan/assets/phase-template.md`; after `sync.cjs` both exit 0 |
| 3 | `node scripts/check/run.cjs` reports no HOOKS-01, HOOKS-02 or REPO-06 finding for aidd-dev or aidd-pm |
| 4 | `node --test scripts/__tests__/artifact-hook.test.js scripts/__tests__/check/*.test.js` passes; the `run.md` Stop and the shell-marked Stop each measure under 5 s |
