# Mutation proofs

For each rule, the test that guards it, the one scripted change that breaks the rule, and what
turned red. Each mutation was applied by script on the file named, the named tests were run,
and the file was restored byte for byte.

## Phase 3, count (`da23cff3`)

| Rule | Test | Mutation | Red |
| --- | --- | --- | --- |
| Key with request id | "keys a call by message id and request id" | `:requestId` dropped from the key | yes |
| Requestless key | "keys a requestless call by message id, session id and timestamp", "reads an empty request id as none" | timestamp dropped from the key | yes |
| Synthetic dropped | "drops the synthetic model" | synthetic constant changed | yes |
| Sidechain or agent id is a subagent | "calls a sidechain line a subagent", "calls a line carrying an agent id a subagent" | each check forced false | yes |
| Cache writes summed over message iterations | "sums cache writes…", "does not take the top-level cache write…" | top-level usage only | yes |
| One-hour part unknown when a split is missing | "leaves the one-hour part unknown when any iteration lacks its split" | sum even when a split is null | yes |
| Advisor iterations are their own records | "makes each advisor iteration its own record…" | key `#advisor` without index; wrong iteration type | yes |
| Unrecognised shape reported | "reports a usage line of an unexpected shape…" | identity check disabled | yes |
| Unknown counter is null, never 0 | "leaves a missing counter unknown, never zero…" | `?? 0` on counters | yes |
| Fold: largest total, then earliest instant, then lowest session id | "keeps the record with the largest total", "breaks a tie on total by the earliest time", "compares times as instants", "breaks a tie … by the lowest session id" | each comparison reversed | yes |
| Order independence | "gives the same records whatever the order of the input" | final tie-break or output sort removed | yes |
| Fold across files | "folds a key across files…" | key prefixed by file path | yes |
| Recursive walk, set-asides included | "walks sub-agent directories at any depth", "finds a set-aside whatever its suffix" | no recursion; regex drops `.superseded-*` | yes |
| Byte offsets, unterminated last line, shrunk or replaced file | "counts offsets in bytes…", "does not consume an unterminated last line…", "reads a shrunk file whole", "reads a replaced file whole…" | read from 0; consume to end; size or identity check disabled | yes |
| `CLAUDE_CONFIG_DIR` wins | "is projects/ under the configured directory when there is one" | always the config dir | yes |

## Phase 4, store (`a80242cc`)

| Rule | Test | Mutation | Red |
| --- | --- | --- | --- |
| Idempotent re-ingest, deterministic replacement | `stored-usage` "same record comes again", "better snapshot" | held-first order reversed; held always wins | yes |
| Newline guard | snapshot store "crash left no newline" | guard removed | yes |
| Stale lock: dead pid, age; live lock respected; released only by owner | `ledger-lock` tests | each check dropped; unconditional `rm` | yes |
| Consent version, unreadable consent, `AIDD_TELEMETRY=0` | consent and ingest tests | version check dropped; unreadable as absent; refusal removed | yes |
| Never seen alive not stored; persisted resolution after deletion | ingest tests | counted as outside-repo; persisted ignored | yes |
| Remote variants give one id; root-commit fallback; lowest root commit; worktree same id | `repository-identity`, locator integration | normalisations dropped; fallback null; highest root; id from root path | yes |
| Snapshot dedupe; creation time kept; lower-cased config keys | `branch-binding`, snapshot use case | always snapshot; carry-forward removed; lower-casing removed | yes |
| Month partition by UTC instant; positions written last; unchanged partition untouched | `stored-usage`, ledger adapter, ingest | month from raw text; positions dropped; always rewrite | yes |
| Owner-only dir and file | `private-storage` | chmod removed; mode 0644 | yes |

## Phase 5, declare (`9be2a8f5`)

| Rule | Test | Mutation | Red |
| --- | --- | --- | --- |
| Default branch and detached never bound | `branch-role`, declare use case, shared fixture | default check false; detached as working | yes |
| Latest declaration wins from its own time, tie to the later line | `binding-resolution`, fixture `two-declarations-at-one-instant-the-later-line-wins` | `time <= at` dropped; `>=` to `>` | yes |
| None declaration | resolution and `task-declaration` tests | `none` ignored; writer sets `none: false` | yes |
| Snapshot at once; keys survive rename; stale ticket removed | declare use case tests | snapshot call removed; key prefix changed; unset skipped | yes |
| Fixture field drift | fixture "is written with the fields the CLI writes" | writer emits `declaredAt` | yes |

## Phase 6, ask (`165c7c0b`)

| Rule | Test | Mutation | Red |
| --- | --- | --- | --- |
| Claude-only guard | claude-only fixture cases, Codex and Copilot payloads, Codex rollout under `projects/` | session-id equality, `projects` check or rollout rejection removed | yes |
| Presence | presence matrix | `ATTENDED=1` or `sdk*` rule dropped; absent entrypoint accepted | yes |
| Consent | consent fixture, `AIDD_TELEMETRY` | version, env refusal or worktree fallback dropped | yes |
| Default and detached pass | branch-role fixture | forced `working` | yes |
| Answer-path check | aidd absent, no `telemetry task` | `canAnswer` always true | yes |
| Strict intercept | 22-prompt injection test | forbidden-character, unknown-option or word-only check removed | yes |
| Clear and fork carry | clear, chain, other pid, unbound, pid before boot | pid ignored; bound check skipped; boot guard dropped | yes |
| No carry on resume, startup, compact | source matrix | those sources carried | yes |
| Silent catch-up | catch-up test | stdout printed; `--quiet` dropped | yes |
| Declaration suppressed and marked | typed-declaration test | `suppressOriginalPrompt` false; `--by` removed | yes |

## Phase 7, attribute and report (`cbc2ceb9`, `a53833d4`)

| Rule | Test | Mutation | Red |
| --- | --- | --- | --- |
| Session declaration from its time; mid-session redeclaration | `attribution.unit.test.ts` "applies a later declaration from its own time only" | time ignored; carried floor uses latest declaration | yes |
| Carried session moved whole by its first declaration | "is moved whole by its first declaration, the work before it included" | floor ignores declarations | yes |
| Carry covers the whole carried session | fixture `carried-before-the-carry-falls-to-branch` | carry floor −∞ | yes |
| Branch binds after creation; declared after the work; repository and name | attribution branch tests | creation check removed; from declaration time; name-only lookup | yes |
| Reused branch name keeps generations | "keeps the work of an earlier branch of that name on its own task" | latest snapshot only | 7 red |
| `declared-none`; session beats branch; subagent inherits | attribution tests | none as no-binding; order swapped; session lookup skipped | yes |
| Unknown counter never summed as zero | `usage-report.unit.test.ts` | null no longer counted | yes |
| Every axis reconciles | `usage-report.property.unit.test.ts` | ticket rows without ticket dropped | yes |
| Identity shape; oldest transcript date | identity and ingest tests | one-field rule relaxed; result null | yes |

## Phase 8, opt in, opt out, forget (`8f9a757f`)

| Rule | Test | Mutation | Red |
| --- | --- | --- | --- |
| Hook line and delegate go together | lifecycle "keeps the script while a lefthook job still calls it…", husky variant | `callers.length === 0` to `>= 0` | 2 red |
| Foreign hook content byte for byte | "keeps a hook's other content byte for byte, and its mode" | lines trimmed on rejoin | yes |
| Forget preview changes nothing | "previews and changes nothing on disk, not a byte nor an mtime" | `!confirmed` to `confirmed === undefined` | yes |
| Offsets reset on `on` | "is stored once opting in, though ingest had read past it" | `resetPositions()` removed | yes |
| `on` writes version 2; `off` keeps version | switch tests | `version` dropped; spread dropped | yes |
| Remembered roots re-resolved | "is stored for a directory that is gone, whose refusal was remembered" | `resolutions.save` removed | yes |

## Phase 9, skills and journey (`2486849d`, `e6b04615`)

| Rule | Test | Mutation | Red |
| --- | --- | --- | --- |
| Skills name only real commands, flags, axes | `telemetry-skills-name-real-commands.test.js` | `report` to `reprt`; `--yes` to `--yess`; `--axis tasks`; `--axis tickets` in `frame.md` | yes, each |
| Skills never name hooks or V1 | same test | a "hook" word added | yes |
| Journey: carry, presence, gate, carries in report | `telemetry-journey.e2e.test.ts` | carry never written; presence false; gate skips presence; carries ignored | yes, each |

Phase 8 rows were later revised by the consent move (fix round 1): consent is git config now, and its mutations are below.

## Fix round 1, phase 4 (store, ingest, consent)

| Rule | Test | Mutation | Result |
| --- | --- | --- | --- |
| Partitioning is linear in the records | `stored-usage.unit.test.ts` "copies each record a bounded number of times" (counts array iteration, deterministic) | `partitionByMonth` copies the month array per record again (`[...(held ?? []), record]`) | 1 red, that test (2,003,001 elements touched at n=2000 before the fix) |
| An upsert names the months it changed, the old month of a replaced record included | `stored-usage.unit.test.ts` "names the months it changed" | loop over `[record]` instead of `[record, was]` | 1 red, that test |
| Ingest tells the ledger which months to write | `ingest-usage-use-case.unit.test.ts` "rewrite only the month a new call falls in" | `save(merged.records)` without the months | 1 red, that test |
| A save told the months reads and writes only those | `usage-ledger-adapter.integration.test.ts` "rewrites only the months it is told changed" | the filter by told months removed | 1 red, that test |
| A snapshot reads and appends under the bindings lock | `snapshot-bindings-use-case.unit.test.ts`, `bindings-lock-adapter.integration.test.ts` "leaves one snapshot when ... at once", `declare-task-use-case.unit.test.ts` | `append` called without `lock.exclusively` | 3 red: the snapshot lock order, the concurrent-snapshot test (3 writers, more than 1 snapshot), the declare order |
| A declaration's session line is appended under the bindings lock | `declare-task-use-case.unit.test.ts` (event order, default-branch order) | `sessions.append` outside the lock | 2 red, those tests |
| A declaration never waits on the ledger lock | `telemetry-task.e2e.test.ts` "declares at once while an ingest holds the ledger lock" | not mutated: before the fix the test timed out at 5 s (declaration blocked, 60 s lock wait); the declare use case no longer receives the ledger | red on the pre-fix binary, green after |
| `on` lifts a remembered refusal by repository, a deleted linked worktree included | `resolution-consent.unit.test.ts`, `telemetry-switch-use-cases.unit.test.ts` "linked worktree deleted before the opt-in" | `ofRepository = false` | 2 red |
| `on` passes the repository id | same use-case test | `repositoryIdOf(located)` replaced by `null` | 1 red |
| A declaration is read at the call's time within a branch generation, the first one covering from creation | `attribution.unit.test.ts` three new "redeclaration" tests | `generationAt` returns `generation.at(-1)` (latest snapshot) | 3 red |

## Fix round 1, phase 6 (hooks)

| Rule | Test | Mutation | Result |
| --- | --- | --- | --- |
| A prompt that only starts like a declaration, or holds shell syntax, goes to the ordinary gate and spawns nothing | `aidd-telemetry-hooks.test.js` "injection" and "only starts like a declaration" | an intercepted prompt that does not parse blocks "not understood" again | 2 red |
| The `cmd.exe /s` line has an outer pair of quotes | same file, "cmd.exe /s command line" | `cmdLine` returns `"shim" args` | 1 red |
| The hook's home is the OS home, as the CLI's | same file, "the telemetry directory's home" | `home ?? set(env.HOME) ?? os.homedir()` | 1 red |
| A committed `.aidd/config.json` is not consent | same file, "a committed .aidd/config.json is not consent" | the hook also accepts a committed `telemetry.version === 2` | 1 red |
| `AIDD_TELEMETRY=0` refuses before git is asked | same file, "AIDD_TELEMETRY=0 refuses" and the session-start test | the environment check removed | 2 red |

## Fix round 1, phase 8 (consent, leftovers, forget)

| Rule | Test | Mutation | Result |
| --- | --- | --- | --- |
| Nothing in `.aidd/config.json` is consent (CLI) | `git-consent-adapter.integration.test.ts`, `telemetry-lifecycle.integration.test.ts` | the adapter falls back to a committed `telemetry.version === 2` | 2 red |
| `AIDD_TELEMETRY=0` refuses (CLI) | `declare-task-use-case.unit.test.ts`, `ingest-usage-use-case.unit.test.ts` | each refusal check removed in turn | 1 red each |
| `on` removes the previous version's block, and deletes the file only when emptied | `telemetry-switch-use-cases.unit.test.ts`, `telemetry-lifecycle.integration.test.ts` | the legacy cleaning replaced by "none" | 6 red |
| `off` writes `off` | `telemetry-switch-use-cases.unit.test.ts` | the write removed | 1 red |
| `forget` unsets the consent key | `repository-declarations-adapter.integration.test.ts` | the consent key left out of the unset loop | 1 red |
| `forget` finds a repository that only opted in | `forget-telemetry-use-case.unit.test.ts` | consented resolutions no longer added | 1 red |
| `on` ends with the next step | `telemetry-lifecycle-display.unit.test.ts` | "Next:" line reworded | 1 red (after the test was tightened: the first version of the test survived this mutation) |
| The unknown-counter message says what happens to the call | the two display tests | message back to "not recognised and not counted" | 2 red |

Not mutated: removing `outside-repo` and `root-unresolved` from the unattributed reasons (a
type-level change: the exhaustive `Record<Reason, string>` makes a reinstated reason fail the
typecheck), and the documentation corrections.
