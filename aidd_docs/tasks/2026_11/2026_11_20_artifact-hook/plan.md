---
objective: "An artifact the model wrote in a turn is judged by its contract at the turn end, each finding handed back once as `file:line rule fix`, silent otherwise."
status: pending
---

# Plan: Artifact check at turn end, tranche 2a

Source: [spec.md](./spec.md), https://github.com/ai-driven-dev/framework/issues/1149

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1   | Contracts declare their `scope` | [`phase-1.md`](./phase-1.md) | none |
| 2   | Artifact hook, its generated copies, aidd-dev and aidd-pm wired | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | aidd-context wired through its one Stop entry, docs, full checks | [`phase-3.md`](./phase-3.md) | 2 |

## External sources

| URL | What it settled |
| --- | --------------- |
| none | the bridges and adapters in `cli/` settled the Stop question; how Claude Code, Codex, Copilot and Cursor combine two Stop answers was not looked up and stays unverified |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| runtime | Two Stop entries in one plugin break the turn guard on the bridged hosts. In `opencode-hooks-bridge.ts:219-231` the second call gets `stop_hook_active` from the first answer and is silenced, then its empty reason deletes the session from `continued`. In `kilo-hooks-bridge.ts:158-166` `session.continued = reason !== ""` is rewritten by each hook. Both are observed in the code. aidd-context therefore keeps one Stop entry. | 3 |
| runtime | The same bridge behavior already holds across plugins (aidd-ui and aidd-context today; aidd-dev and aidd-pm next). It is a residual risk owned by `cli/`, out of scope, and needs a follow-up ticket. | none |
| runtime | The generate skills write rules, agents and commands through Bash writers (`write-rule.cjs:460`, `write-agent.cjs:230`, `write-command.cjs:164`, `scaffold-skill.cjs`). A shell write gives `event.files` empty (`host.cjs:38-50`); it only carries `command`. Observed. Covered by mtime detection (Decisions). The PostToolUse matcher now includes shells, so the hook spawns once per shell command, as aidd-ui's already does (`plugins/aidd-ui/hooks/hooks.json`). | 2, 3 |
| runtime | OpenCode's bridge fires SessionStart once with `session_id: null` (`opencode-hooks-bridge.ts:204-209`), so the first turn of an OpenCode session has no reference time, and shell writes in that turn are not detected. Observed. | 2 |
| runtime | `run-record.cjs:15-16` spawns `git` twice on a written `run.md`. ARCHITECTURE hooks rule 5 asks for a measurement under the 5 s timeout. Unverified until measured. | 2 |
| runtime | The CLI swaps `hooks/lib/host.cjs` per plugin for every tool (`hooks-descriptor.ts:41`, `scriptDir: "hooks"`). Whether nested `hooks/lib/contracts/**` ships whole is unverified; the spec gives the install test to a separate ticket. | none |
| regression | Editing `engine.cjs` makes the 7 `skills/*/scripts/lib/engine.cjs` copies stale (`sync.cjs:27-41`). `memory-hook.test.js:137` asserts a turn end leaves the temp folder empty, so the merged Stop must not create state folders. Tests already cover both: `scripts/__tests__/check/{engine,sync,run}.test.js`, `memory-hook.test.js`. Risk is medium; no safety-net phase is needed. | 1, 3 |
| regression | SKILL-22 `sibling-plugin.cjs:11-13` takes the folder above `skills/` as the plugin. In a user's `.claude/skills/x` that folder is `.claude`, so every `aidd-*:*` mention would be flagged, a false positive. | 1 |
| architecture | Today a contract only checks the framework repo (`targets`). Contracts now also name user-project paths (`scope`). A plugin's `hooks/` folder gains generated contract copies kept by `sync.cjs`, the way `skills/*/scripts/lib` are kept today. | 1, 2 |
| documentation | The Hooks section of `docs/ARCHITECTURE.md` (rules 1, 4, 7) names aidd-context and aidd-ui only. It must name the artifacts concern and the shared Stop entry. Rule 7 is already stale (commit e68f07db9) and is touched only where this feature changes it. | 3 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `docs/ARCHITECTURE.md` Hooks rules 2, 4, 6, 8 | the handler answers through `hooks/lib/host.cjs`, one entry per concern, a 5 s timeout, exit 0, an `AIDD <Plugin>:` status message |
| REPO-06 `hook-rule-copies.cjs` | `hooks/lib/host.cjs` is byte-identical to `cli/assets/hooks-runtime/host-claude.cjs` and present only when a hook requires it |
| HOOKS-01/02 `hooks-schema.json`, `handlers.cjs` | every new hooks.json entry matches the schema, and its handler exists and parses |
| A plugin never reads outside itself (spec) | everything the hook needs from a skill is a generated copy under that plugin's `hooks/` |

## Decisions

| Decision | Why |
| -------- | --- |
| aidd-context keeps one Stop entry, `memory.cjs sync`, which calls the generated `artifacts.cjs`'s exported `atStop(event)` and answers once with both texts | on OpenCode and Kilo a second Stop entry is silenced and resets the loop guard (Impact, runtime). The handler stays byte-identical across plugins, and `memory-hook.test.js` keeps its goal mapping |
| A contract's `scope` holds user-project globs. A file unit matches the file. A folder unit is the nearest ancestor of the written file, up to the project root, that matches a `scope` glob and holds `contract.marker` | the contract stays the one source of where its artifacts live, and the hook knows no kind |
| Shell writes are found by mtime. SessionStart writes `<sessionId>.ref` (time = now), and each Stop rewrites it at its end, so the reference is the previous turn's end or the session start. A shell PostToolUse (`command`, no `files`) records only `shell` in the mark, no time, because the command already finished. At Stop, when the mark says `shell`, the files under the contracts' `scope` globs with mtime > reference join the written files, deduped. With no reference (OpenCode's first turn) the shell scan is skipped. The `.ref` is written only into a state folder that already exists | SessionStart is the simplest correct start. A mark-creation-time fallback is wrong because the first shell's files predate its own PostToolUse. Writing only into an existing folder keeps `memory-hook.test.js:137` (no state from memory alone) true |
| Accepted limit: a hand edit inside a `scope` folder during the model's turn, when a shell ran, is judged too | only the model sees the answer, and the person loses nothing |
| Rejected: writers validate themselves; `git status`; parsing the shell command or its output | self-validation covers only the 3 writers and duplicates the hook. `git status` needs git and reports the person's own work. Parsing is host-specific |
| Findings are kept only on files the turn wrote | the spec says a file the model did not write is never reported. A cross-file rule (PLAN-03, PLAN-05) whose finding lands on an unwritten `plan.md` is dropped |
| Copies live under `hooks/lib/contracts/<skill>/` mirroring the skill (`scripts/contract.json`, `scripts/lib/*`, `scripts/custom/**`, the `assets/` files the contract names) | `ops.cjs:121,161` resolves templates from `contractDir/../assets` and custom checks from `contractDir/custom`, and custom checks require `../lib/*.cjs`. `aidd-context/hooks/lib/markdown.cjs` is a different file from the engine's, so the engine cannot sit flat in `hooks/lib/` |
