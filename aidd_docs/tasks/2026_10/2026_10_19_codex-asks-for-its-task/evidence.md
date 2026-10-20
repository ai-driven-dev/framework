# Evidence

## Observed on a real Codex CLI 0.163.0

Isolated `CODEX_HOME`, scrubbed environment, a probe hook on SessionStart and UserPromptSubmit recording field and variable names only, never values of secrets or prompt text.

| Fact | Observed |
| --- | --- |
| Hooks run in `codex exec` and in the TUI | SessionStart (`source: startup`) and UserPromptSubmit fire in both |
| Payload | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, `permission_mode`; SessionStart adds `source`, UserPromptSubmit adds `turn_id`, `prompt` |
| Session variable | none. Codex-specific variables: `CODEX_HOME`, `CODEX_MANAGED_BY_NPM`, `CODEX_MANAGED_PACKAGE_ROOT`. Hook stdin and stdout are not terminals |
| `permission_mode` | TUI `default`, `exec` `bypassPermissions` |
| `decision: block` with a reason, TUI | shown as "• Blocked by hook └ <reason>"; the prompt is not sent; that turn writes no call |
| `decision: block` with a reason, `exec` | the prompt is not sent, 0 tokens, exit 0; the reason appears on no channel (stdout JSON, stderr) |
| Session file first line | `session_meta`: TUI `source: cli`, `originator: codex-tui`; `exec` `source: exec`, `originator: codex_exec` |
| Tokens | `exec --json` `turn.completed` usage equals the sum of the session file's per-call records, for a one-call and a two-call turn |

## From the openai/codex source at rust-v0.163.0

Report kept outside the repository; the points used here:

- The IDE extension and the desktop app both record `source: vscode`; `originator` tells them apart (`codex_vscode`, `Codex Desktop`). No payload field or variable names the surface.
- A block works only for a synchronous hook. Async handlers exist (`async` is part of a handler's identity).
- Trust: a handler's identity is its event, matcher and handler config (command, timeout, async, …), not the script's content. A changed entry is skipped until trusted again; reordered entries are untrusted.
- A resumed thread keeps the originator it was created with; the originator is per process.
- Plugin hooks receive `PLUGIN_ROOT`, `PLUGIN_DATA`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`.

## The TUI's first line under plugins

Isolated `CODEX_HOME`, the plugin installed by `aidd setup` from this branch, hooks trusted. The hooks ran, but the prompt was not asked: the session file's first line says `source: "vscode"`, `originator: "codex-tui"`, where the bare-config probe above said `source: "cli"`. With plugins installed the TUI runs through the app server, which hard-codes `SessionSource::VSCode`. `permission_mode` was `default` and `agent_id` absent. A probe hook saw no controlling terminal (`/dev/tty` gave ENXIO, the parent's tty `??`), so a terminal is no signal either.

Read-only on the maintainer's sessions under `~/.codex/sessions`, first-line `source|originator` pairs, counts only: `vscode|codex-tui` 29, `cli|codex-tui` 4, `object|codex-tui` 266 (sub-agents), `exec|codex_exec` 143, `object|codex_exec` 26, `vscode|Codex Desktop` 3, `vscode|codex_work_desktop` 3, `vscode|Claude Code` 2. The rule therefore reads `originator` alone and refuses an object `source`.

## First line of a Codex session file

Measured read-only on the maintainer's machine, by byte length only, over every plain `rollout-*.jsonl` under `~/.codex/sessions`: 476 files, first line 18,552 bytes minimum, 22,740 median, 23,215 p90, 23,477 p99, 48,786 maximum; every file had a first newline. The 1,056 `.jsonl.zst` files were not measured: a hook is handed a plain file (a resumed compressed file is expanded back for append). The hook reads 1 MiB, about 21 times the largest seen.

## Real run

Codex 0.163.0. The plugin was installed by `aidd setup --source local` from this branch into an isolated `CODEX_HOME`, and its hooks trusted with `/hooks` in the TUI. Aggregates only.

| Step | Observed |
| --- | --- |
| TUI, undeclared working branch, prompt | held: "• Blocked by hook └ Telemetry: no task on feat/real-run yet. …" |
| TUI, typed declaration | "• Blocked by hook └ Task real-run-demo (ticket T-42) declared. Send your prompt again." |
| TUI, prompt again | answered |
| `codex exec` on another undeclared branch | answered, never held; payload `permission_mode` `bypassPermissions`, first line `exec`/`codex_exec` |
| `report --axis task` | TUI calls on `real-run-demo`, the exec call "unattributed: no task declared". `--axis ticket` shows `T-42` |
| Tokens | report total 46,578 equals the sum of `usage.total_tokens` over the session files' records (3 calls). The exec session's 15,148 equals `codex exec --json` `turn.completed` input+output |
| First line under the TUI | `source` `vscode`, `originator` `codex-tui` |
| Hook process, TUI and exec | no controlling terminal (`/dev/tty` ENXIO) |
| Desktop app | a hook's `decision: block` is shown ("Le hook a bloqué ce message" followed by the reason); the prompt is not answered. Payload: first line `vscode`/`codex_work_desktop`, `permission_mode` `bypassPermissions` |
| Desktop, hook trust | Desktop trusted the folder but offered no hook review. The hook stayed untrusted and was skipped silently until it was trusted with `/hooks` in the TUI; Desktop then ran it, since trust is shared through `config.toml` |

A branch declaration also attributes the branch's calls made before it. That rule predates this change and is unchanged.

## Red run

Each test written before its code, run and seen failing for the reason it names.

- Phase 1, hooks (`node --test scripts/__tests__/aidd-telemetry-hooks.test.js`, `lib/tool.cjs` stubbed at the old behaviour, Claude Code only): `ℹ tests 74`, `ℹ fail 7`, `ℹ pass 67`. Failing, each for its own reason:
  - `hook tool: every fixture case is Claude Code's, Codex's or neither`: `codex-rollout-path-with-the-inherited-claude-id`, `actual: null, expected: 'codex'`;
  - `codex presence: a prompt is held when, and only when, every condition holds`: the rows expected held were not, `[ 'the TUI', 'the TUI started inside Claude Code', 'a first line well inside the bound' ]`;
  - `codex: a typed declaration binds the payload's session`: `actual: null`, the block expected;
  - `codex: a mistyped declaration is told so, naming Codex`: `actual: null`;
  - `codex: session start does nothing, not even the consent check`: `actual: 1, expected: 2`, the gate never reached the consent check;
  - `codex: the catch-up ingests, silently, once`: `actual: []`, the ingest expected;
  - `codex: the gate asks on an undeclared working branch`: no block.
  - Every Claude Code test stayed green (H4).
- Phase 2, the session a declaration binds (`vitest run tests/runtime/wiring/telemetry-wiring.unit.test.ts`): the five `the session a declaration binds` cases `×`, `declaringSessionOf` not exported.
- Phase 2, end to end (`vitest run --project e2e tests/e2e/telemetry-journey.e2e.test.ts -t Codex`, `declaringSessionOf` put back to `CLAUDE_CODE_SESSION_ID` alone): `×`, `ENOENT: no such file or directory, open '…/telemetry-dir/bindings/sessions.jsonl'`: the Codex declaration bound no session.
- Phase 3, the merged `.codex/hooks.json` (`vitest run tests/contexts/tools/domain/formats/flat-hooks-merge.unit.test.ts`): `Tests  3 failed | 38 passed (41)`, among them `expected { type: 'command', …(2) } to match object { async: true, timeout: 120 }`.
- Checker round 1, the session named for both tools: `✖ a stale AIDD_TELEMETRY_SESSION_ID exported by the user does not win over the session of the prompt` (`actual: [ '…00bb' ]`, the stale value bound) and `✖ a typed declaration reaches no model …` (`actual: null, expected: '…00aa'`).
- Real-run correction, presence table: `✖ codex presence: a prompt is held …`, the new rows `'the TUI through the app server (source vscode)'` and `'no source'` were not held.

## Verification

### The hooks, mutation by hand

Stryker mutates `cli/` only, so each rule of the hooks was broken by hand, the hook suite run, and the change reverted. Every mutation turned red the test named for it:

| Mutation | Red |
| --- | --- |
| Codex guard returns nothing | the fixture test, every `codex:` test, the presence table |
| Codex guard ignores `session_id` | `hook tool: every fixture case …` |
| any `.jsonl` path is Codex | the fixture test, two Claude Code consent and catch-up tests |
| Codex path not normalised | the fixture test (`codex-windows-rollout-path`) |
| `originator`, `source`, `type`, `agent_id` unchecked, each alone | the presence table |
| `permission_mode` only refuses `bypassPermissions` | the presence table (`no permission_mode`, `a permission_mode never seen`) |
| bound 4 MiB / 64 KiB | the presence table (`past the bound` / `well inside the bound`) |
| whole file read as the first line | the presence table and the Codex gate tests |
| env injection removed (`const env = process.env`) | the stale-value test, the Claude Code declaration test, the Codex declaration test |
| object `source` no longer refused | the presence table (`a sub-agent's file, its source an object`) |
| session start runs for Codex | `codex: session start does nothing, not even the consent check` |
| Codex declaration names no session | `codex: a typed declaration binds the payload's session …` |
| every declaration names a session | `a typed declaration reaches no model …` (Claude Code's binds its own variable) |
| Codex block hides the prompt | `codex: a typed declaration binds the payload's session …` |
| Codex told to ask Claude | `codex: a mistyped declaration is told so, naming Codex` |
| Codex presence read as Claude Code's | the presence table and the Codex gate tests |

Two earlier mutations survived and the rule behind each was deleted rather than tested: an anchored `rollout-….jsonl$` path (the Claude Code guard's own pattern is reused), and a separate refusal of a first line with no end (a line cut at the bound is no JSON).

## Gates

Run in a sandbox: `HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME` fresh temp dirs, `GIT_CONFIG_NOSYSTEM=1`.

| Gate | Decisive line |
| --- | --- |
| `pnpm exec lefthook run pre-commit` | every job `✔️` (cli-architecture, cli-biome, cli-type-honesty, cli-typecheck, doc-duplication, markdown-links, no-local-paths, recipe-validity, referenced-paths, scripts-tests, summarize-plugin-catalogs, sync-readme-counts), `summary: (done in 48.10 seconds)`, exit 0 |
| `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` | `ℹ tests 476`, `ℹ pass 476`, `ℹ fail 0`, exit 0 |
| `cli`: `pnpm lint` | exit 0, `Found 1 warning.` (`uninstall-use-case.ts`, untouched) |
| `cli`: `pnpm typecheck` | `tsc --noEmit`, exit 0 |
| `cli`: `pnpm test:arch` | `Tests  168 passed (168)` |
| `node scripts/check-cli-type-honesty.mjs` | `No type is widened through unknown, any or never …` |
| `cli`: `pnpm knip` | exit 0 |
| `cli`: `pnpm test` | `Test Files  526 passed \| 1 skipped (527)`, `Tests  6862 passed \| 1 skipped (6863)` |
| `cli`: `pnpm build` | `Bundle size: 705.9 KB / budget: 709 KB`, `OK: within budget` |
| `cli`: `pnpm smoke` | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%` |
| `node scripts/check-claude-tokens-end-to-end.cjs` | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository`, exit 0 |
| `… --attended` | `…; asked, answered by the hook, kept across /clear`, exit 0 |
| `cli`: `node scripts/run-mutation.mjs --changed` | 15 mutants over 3 files, `score 100.0, 6 changed range(s) since origin/next` |
| `node scripts/check-no-local-paths.js` | `✅ No local paths: 0 leak(s) in 0 file(s)` |

