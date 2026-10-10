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
| ~~Consent~~ | ~~consent fixture, `AIDD_TELEMETRY`~~ | ~~version, env refusal or worktree fallback dropped~~ | superseded: this row described the deleted file-based consent (`.aidd/config.json`, a version). Consent is the clone's git config now: see Fix round 1 phase 6 and phase 8 |
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
| ~~`on` writes version 2; `off` keeps version~~ | ~~switch tests~~ | ~~`version` dropped; spread dropped~~ | superseded: the file-based switch is deleted. `on` writes `aidd.telemetry=2` and `off` writes `off` in git config: see Fix round 1 phase 8 |
| ~~Remembered roots re-resolved~~ | ~~"is stored for a directory that is gone, whose refusal was remembered"~~ | ~~`resolutions.save` removed~~ | superseded by fix round 2: `on` rewrites no remembered refusal, a deleted directory is judged by its clone |

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
| ~~`on` lifts a remembered refusal by repository, a deleted linked worktree included~~ | ~~`resolution-consent.unit.test.ts`, `telemetry-switch-use-cases.unit.test.ts`~~ | ~~`ofRepository = false`~~ | superseded by fix round 2: the lifting by `repository_id` leaked consent across clones and is deleted |
| ~~`on` passes the repository id~~ | ~~same use-case test~~ | ~~`repositoryIdOf(located)` replaced by `null`~~ | superseded by fix round 2, with the lifting |
| A declaration is read at the call's time within a branch generation, the first one covering from creation | `attribution.unit.test.ts` three new "redeclaration" tests | `generationAt` returns `generation.at(-1)` (latest snapshot) | 5 red (recorded 3 before; re-run in fix round 2 over `tests/contexts/telemetry`: the three new redeclaration tests, "speaks with the latest snapshot of one declaration…" and "lets a snapshot with no declaration time cover from the creation…") |

## Fix round 1, phase 6 (hooks)

| Rule | Test | Mutation | Result |
| --- | --- | --- | --- |
| A prompt that only starts like a declaration, or holds shell syntax, goes to the ordinary gate and spawns nothing | `aidd-telemetry-hooks.test.js` "injection" and "only starts like a declaration" | an intercepted prompt that does not parse blocks "not understood" again | 2 red (since narrowed by fix round 2: only a prompt that attempts a declaration is told so) |
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

Rows before fix round 1 record "yes" and no count: they were not counted then, and are not re-run here. Only the row corrected above was re-run.

Not mutated: removing `outside-repo` and `root-unresolved` from the unattributed reasons (a
type-level change: the exhaustive `Record<Reason, string>` makes a reinstated reason fail the
typecheck), and the documentation corrections.

## Fix round 2

Every row below was re-run at the final HEAD of the round: the mutation applied by script to the
file named, the scope run (`npx vitest run tests/contexts/telemetry tests/presentation` plus
`tests/contexts/tools` and `tests/contexts/framework/application/plugin` for the Codex row, and
`node --test scripts/__tests__/aidd-telemetry-hooks.test.js` for the hook row), and the file
restored (checked equal to the original by the script). Counts are failing tests.

| Rule | Test | Mutation | Result |
| --- | --- | --- | --- |
| `on` lifts nothing: a clone's consent never reaches another clone sharing the remote or the root commit | `telemetry-switch-use-cases.unit.test.ts`: (b) "keeps refusing a deleted clone of the same remote that never opted in", (c) "keeps refusing a clone of the same remote that ran off, deleted or not" and "keeps refusing what a clone made while off, though it ran on first and was then deleted", (e) "keeps refusing a deleted copy with no remote that shares the root commit", and "resets the offsets … rewrites no refusal" | `rememberOwnRoot` also marks every remembered resolution of its `repository_id` consenting (the lifting reintroduced) | 5 red, those five. Before the fix (b), (c) and (e) were red for the same reason |
| A deleted directory is judged by its clone's git config read live; the remembered flag only once the clone is gone | `ingest-usage-use-case.unit.test.ts` "a directory that is gone is judged by the clone it belonged to"; `telemetry-switch-use-cases.unit.test.ts` "stores a deleted linked worktree of the clone that opted in"; `telemetry-lifecycle.integration.test.ts` "is stored for a directory that is gone, whose refusal was remembered" | `fromMemory` always takes the clone as gone (remembered flag only) | 6 red |
| `off` withdraws what was remembered of its own clone, so a deleted clone is not judged by a stale yes (my reading of "the remembered consent is used only when the clone is gone": the memory has to be right for that case) | `telemetry-switch-use-cases.unit.test.ts` "keeps refusing what a clone made while off, though it ran on first and was then deleted", "withdraws what was remembered of the clone's other directories, and of no other clone", "writes under the ledger's lock …" | the `forgetConsentOfClone` call removed from `off` | 3 red |
| `off` lowers the clone's own entries only | same file, "withdraws what was remembered of the clone's other directories, and of no other clone" | the clone check removed in `forgetConsentOfClone` | 1 red |
| `on` remembers its own root, so `forget` finds the clone though no session ever ran there | `telemetry-switch-use-cases.unit.test.ts` "remembers its own root, seen alive, so forget can find the clone later"; `telemetry-lifecycle.integration.test.ts` "unsets the consent of a clone where `on` ran and no session ever did, and of one that ran off" (the in-process twin of the e2e "leaves no consent behind in a clone where `on` ran and no session ever did") | `rememberOwnRoot` records nothing | 5 red, the integration twin among them. The e2e on the built binary was not run against this mutation |
| `forget --yes` clears the consent of every clone recorded, those `on` recorded included | `forget-telemetry-use-case.unit.test.ts` "clears the consent of a clone `on` remembered, though no session ever ran there" and the rest of the clone-keyed suite | forget skips the clones recorded as consenting | 12 red (the whole clone-keyed suite builds its clones that way) |
| `forget` locates a directory remembered before clones were recorded whatever consent it found | `forget-telemetry-use-case.unit.test.ts` "finds the clone of a directory remembered as refusing before clones were recorded, whose key says off" | a legacy entry is skipped unless it consented | 1 red |
| A mistyped declaration is blocked with the grammar and the quoting hint, and runs nothing | `aidd-telemetry-hooks.test.js` "a declaration mistyped is blocked with the grammar and the quoting hint, and runs nothing" | `attemptsDeclaration` never consulted (always fall through) | 1 red, that test; the injection test and "only starts like a declaration" stay green |
| Ingest rewrites a month that holds a line that is not a record | `ingest-usage-use-case.unit.test.ts` "also rewrites a month that holds a line that is not a record…", "repairs a damaged month even when every call it read was already held" | `damagedMonths` left out of the months saved | 2 red |
| The branch config is read inside the bindings lock | `snapshot-bindings-use-case.unit.test.ts` "reads the branch config, the latest snapshots and appends … inside the bindings lock" | the config read once, before the lock, and passed in | 1 red |
| Each lock names itself in its timeout message | `bindings-lock-adapter.integration.test.ts` "names itself, and its own file, when it times out" | the bindings adapter stops passing its name | 1 red |
| The `total` axis shows its row once | `telemetry-report-display.unit.test.ts` "shows the whole once on the total axis, and a Total row under every other axis" | the `Total` row always added | 1 red |
| The Codex trust notice no longer speaks of a run journal | `codex.unit.test.ts`, `plugin-add-mcp.unit.test.ts` | the old sentence restored | 3 red |
| An unreadable consent is worded as the clone's git config | `telemetry-display.unit.test.ts` "words an unreadable consent as the clone's git config…" | the old `.aidd/config.json` wording restored | 1 red |
| `on` and `off` speak of the clone | `telemetry-lifecycle-display.unit.test.ts` "says measurement is on for this clone, …" | "this repository's linked worktrees" restored | 1 red |
| (re-run) a reused branch name keeps the declaration in force at the call | `attribution.unit.test.ts` "a branch name used again" | `generationAt` returns `generation.at(-1)` | 5 red (the figure the review observed; the 3 recorded before was wrong) |

Not mutated: the help wording (`aidd telemetry on`, `off`, `ingest`) is pinned by the help golden
(`help-surface.e2e.test.ts`); `target.md`, `codebase-map.md`, `telemetry.md`, `usage-contract.md`
and the comment rewording are documentation.

Not seen red before the fix, proved by mutation afterwards: the forget tests, the snapshot-in-lock
test, the unreadable-consent wording test and the Codex notice (the test and the wording were
changed together). Seen red first: the `on`/`off` wording test, the resolver and `on` tests ((b),
(c), (e), the worktree), the `off` tests, the legacy forget test, the hook test, the torn-line
tests, the lock-name test and the duplicate-row test.

## Fix round 3

One predicate, one table. `cli/tests/contexts/telemetry/consent-scenarios.integration.test.ts` runs real git repositories in temporary directories, the real adapters and a real ingest, and states the calls the ledger ends up holding. It was written first, against the code of `309f7393` and nothing newer (only `wireTelemetry` and each use case's `execute`).

Before the fix, per row (`npx vitest run … --reporter=verbose` at `309f7393`):

| Row | Scenario | Before the fix | After |
| --- | --- | --- | --- |
| 1 | (b) deleted clone that never opted in, then `on` in another clone of the remote | pass (fixed in round 2) | pass |
| 2 | (c) clone that ran `off`, then `on` in another clone | pass (fixed in round 2) | pass |
| 3 | (e) deleted copy, no remote, root commit shared, carrying the source's consent | **fail**: `c1` stored while the copy was alive | pass |
| 4 | deleted linked worktree seen alive before `on`, then `on` in its clone | pass | pass |
| 5 | same repository cloned again at the path, then `on`: the old clone's deleted worktree | **fail**: `pw` stored | pass |
| 6 | unrelated repository cloned at the path, then `on`: the old clone's deleted worktree | **fail**: `pw` stored | pass |
| 7 | the old clone's own calls, cloned again at the path, `on` there | **fail**: `po` stored | pass |
| 8 | `on`, calls, `off`, calls, `on`, calls, ingest after each batch | **fail**: the middle call stored | pass |
| 8b | the same, one ingest at the end (added: the result must not depend on ingest timing) | **fail**: the middle call stored | pass |
| 9 | `on`, a manual `off` an ingest observes, calls, clone deleted | **fail**: the call after the observation stored | pass |
| 10 | first `on`, history from before it | pass | pass |
| 11 | `AIDD_TELEMETRY=0` | pass | pass |
| 12 | `forget --yes` after `on`, no session | **fail**, on its precondition: `on` wrote no `ledger/consents.jsonl`. The `forget` and the two assertions after it were not reached at the old code; the file assertion could only have passed vacuously there, the file never existing | pass |

Rows 1, 2, 4, 10 and 11 guard behaviour that was already right: they stay green, and the mutations below show they can go red. Every "not stored" row holds a positive control, a call that must be stored, so none passes because ingest stored nothing. A clone "deleted" in a row is moved aside: a deleted directory's inode may be given to the next one on some file systems, and a row about a clone told apart from its successor must not depend on that.

Only the table was written before the code. The unit and integration tests under it were written with the code and are proved by the mutations below, run afterwards.

Every row below: the mutation applied by script with an exact-anchor check, `npx vitest run tests/contexts/telemetry tests/presentation` (the Node suite for the hook row), the file restored and checked byte-equal. Counts are failing tests.

| Rule | Mutation | Result |
| --- | --- | --- |
| A clone is told from another at its path by its identity | identity ignored, read by path only (`sameClone` and `cloneKey` compare the path alone) | 22 red, including rows 5, 6, 7 |
| A call is judged at its own time | the intervals ignored: any `on` of the clone covers every call | 13 red, including rows 2, 8, 8b, 9 |
| A call made while off is never stored | the off window included: an `off` closes nothing | 19 red, including rows 2, 8, 8b, 9 |
| The end of an interval is excluded | `at <= to` | 4 red |
| The start of an interval is included | `from < at` | 3 red |
| Fail closed when the platform gives no inode | the `ino === 0n` check removed in `identityFromStat` | 1 red: `clone-identity.unit.test.ts` "is none where the platform reports no inode". No table row reaches it: a real macOS stat never returns an inode of 0, so the check is pinned at the seam, and the locator and the consent adapter take an identity reader that the tests make blind |
| Ingest looks at every clone whose consent is open | `observeOpenConsents` not called | 3 red, including row 9 |
| A clone found gone ends its consent | the close on `gone` removed | 2 red |
| A clone whose key is not `2` ends its consent | the close on `absent` removed | 4 red, including row 9 |
| A live clone whose key is not `2` stores nothing, whatever its intervals | `state === "absent"` no longer refuses: live key not required | 8 red |
| The latest clone born by the call answers for a directory | always the latest | 6 red, including row 7 |
| The first clone answers for a call older than every clone | always the first | 4 red, including row 7 |
| `off` ends the interval | the close removed | 6 red, including rows 2, 8, 8b |
| `on` opens the interval | the open removed | 23 red, all thirteen rows |
| `forget` names a gone clone only if it consented | any gone clone named | 2 red |
| Ingest saves the damaged month (round 2's weak test, now asserting which months were saved) | `damagedMonths` dropped from the saved set | 2 red: "repairs a damaged month even when every call it read was already held" and "also rewrites a month that holds a line that is not a record". Observed with the new assertion on the saved months taken out of the test and the same mutation: 1 red, the second test only, which is the review's own line "M5: `damagedMonths` dropped from the saved set only gives 1 red (recorded 2; see 🟢 test gap)" |
| A mistyped declaration says how to send it as an ordinary prompt | the message line removed | 1 red: "a declaration mistyped is blocked…". A second test, "a question mark makes it an ordinary prompt", checks that the way out the message gives works; it is not mutation-proved, because dropping `?` from the `attemptsDeclaration` regex leaves it green (the tokeniser already refuses a `?`) |

Survivors left in the files of this round, none believed to be a gap: `clone-identity-reader.ts` `{ bigint: true }` (an inode above 2^53 cannot be made on the machine this ran on), `clone-identity.ts` `<= 0n` against `< 0n` (equivalent: 0 maps to 0), `birthtimeMs` type check against the finite check (equivalent), `directory-resolver.ts` filter of the current owner (the owner list is the same set), `""` fallbacks on a missing file.

Mutation score of the `telemetry` scope at the head of the round: 96.4 (3,343 detected, 126 undetected), floor 96.

Not mutated: `usage-contract.md`, `target.md`, `codebase-map.md`, `telemetry.md` and the comments; the per-OS notes on the identity in `clone-identity.ts` (macOS observed; Linux and Windows read from Node's `fs.Stats` documentation and libuv's `src/unix/fs.c`, `src/unix/linux.c` and `src/win/fs.c`, v1.x, and not run).
