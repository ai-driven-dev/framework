# Review: A declaration comes only from the command

- Started: 2026-10-16
- Reviewer: a fresh `aidd-dev:checker` agent per round, read-only, sandboxed runs, no mutation run (recorded in `evidence.md`)

## Round 1

- Diff: `origin/next...ed999f81`
- Verdict: request changes, 7.5/10

| # | Class | Finding | Resolution (703b646e) |
| --- | --- | --- | --- |
| 1 | deal breaker | `docs/ARCHITECTURE.md:118` still said "Ask for a task once per branch" | reworded to the gate's real behaviour |
| 2 | suggestion | forget adapter comment said "three keys" | "four keys" |
| 3 | suggestion | usage contract: "Sub-agent and advisor calls…" fell under the new `Branch declaration` heading | moved back under Attribution |
| 4 | suggestion | change history sentence inside the contract | removed |
| 5 | suggestion | rename e2e proved coverage with a deleted branch's call | rewritten: rename `feat/a` to `feat/c`, a call made on `feat/c` is `no-binding`, then attributed by one declaration |
| 6 | suggestion | `-C`/`-M` onto a declared branch leaves keys twice; redeclaring fails | store uses `--replace-all` / `--unset-all`, red test first; rule written in the usage contract and as contract decision 7 |
| 7 | suggestion | always-true conditions left in `binding-resolution.ts` and `attribution.ts` | dropped; `BranchConfigBinding.declared_at` stays nullable because `BranchSnapshot` extends it and stored snapshots can hold `null` |
| 8 | suggestion | fixture JSON reformatted unrelated entries | fixture re-applied as text insertions; diff now only the new cases |

Acceptance after round 1: 1, 2, 4, 5, 6 fulfilled; 3 and 8 partial (findings 5, 1, 3); 7 not re-run by the checker.

## Round 2

- Diff: `origin/next...fd7a31d6`
- Verdict: request changes, 7/10. Round 1 findings 1-5, 7, 8 confirmed resolved; 6 partial.

| # | Class | Finding | Resolution (0c5eab26) |
| --- | --- | --- | --- |
| D1 | deal breaker | after `git branch -C` onto a declared branch, both readers kept the last value per key, mixing the copied task or ticket into the branch's own declaration | any declaration key listed twice makes the branch undeclared, in both readers; red tests in each, fixture case listed in order, e2e; usage contract and contract decision 7 corrected |
| S1 | suggestion | README and skill said a copied branch is always asked again; legacy copies are inherited | both name the cli-v5.5.0 exception |
| S2 | suggestion | forget count test did not include `aiddDeclaredFor` | count test now has four keys |
| S3 | suggestion | spec.md:34 "at most once" unexplained | reading note added under it, pointing to the usage contract |

## Round 3

- Diff: `origin/next...88755b10`
- Verdict: request changes, 6.5/10. Rounds 1 and 2 confirmed resolved; readers agree; M8 decision confirmed.

| # | Class | Finding | Resolution (6c52b68c, fd94dbc1) |
| --- | --- | --- | --- |
| D1 | deal breaker | after `-C`/`-M` onto a declared branch, or a rename onto a reused name, declaring again did not reach the report: the copied reflog made the old generation look younger (`attribution.ts` `generationAt`) | the branch's start is now read as the newest reflog entry where it took its name (`branchCreatedAt`), else its oldest; two e2e tests red first; contract decision 8, usage contract rename bullet and a reflog-expiry limit |
| S1 | suggestion | forget over-counts duplicated keys after `-C` | kept: forget counts the config entries it removes, so the number is what it deletes |
| S2 | suggestion | evidence counts stale (1225, hook count missing) | re-recorded in `evidence.md` |

## Round 4

- Diff: `origin/next...fd94dbc1`
- Verdict: request changes, 7/10. Rounds 1-3 hold, no regression found in six scenarios run against the built binary.

| # | Class | Finding | Resolution |
| --- | --- | --- | --- |
| D1 | deal breaker | a rename by a libgit2 client writes `branch: renamed …` in lower case, which `branchCreatedAt` did not read | 9fa7ff9d: subject matched case-insensitively (`/^branch: (renamed\|copied) /i`), red unit test first |
| S1 | suggestion | before a reused name is declared again, the report still gives its calls to the earlier generation while `status` says undeclared | stated as a limit in the usage contract: only calls the gate did not hold can land there |
| S2 | suggestion | `branch-binding-source.ts` port comments stale | reworded |
| S3 | suggestion | `generationAt` comment spoke only of deleted names | now names copies and renames |
| S4 | suggestion | decision 4's reason said only the reflog tells copy from rename, yet the reflog is now read | reason reworded: the stamp cannot tell them apart; a declaration held only while a reflog entry lasts would change meaning on its own |

## Round 5

- Diff: `origin/next...9fa7ff9d`
- Verdict: request changes, 8/10. Rounds 1-4 hold; readers agree; M8 confirmed.

| # | Class | Finding | Resolution (c7ae6e38) |
| --- | --- | --- | --- |
| D1 | deal breaker | usage contract and decision 4 said a rename always leaves the new name undeclared; an unstamped (cli-v5.5.0) declaration is inherited by a rename too | limit row and decision 4 now say copy or rename |
| S1 | suggestion | dropping no-time snapshots before choosing the generation let an older generation answer for a newer one | generation chosen over every snapshot, then only declared ones speak; red test first |
| S2 | suggestion | task contract limits missed the two added in rounds 3 and 4 | added, pointing to the usage contract |
| S3 | suggestion | round 3 and 4 resolutions named no commit | hashes added |

## Round 6

- Diff: `origin/next...c7ae6e38`
- Verdict: approve, 9/10, no deal breaker. Rounds 1-5 hold; CLI and hook agree on six cases through real git; the flaky run in `evidence.md` judged honestly reported.

| # | Class | Finding | Resolution |
| --- | --- | --- | --- |
| S1 | suggestion | the hand-edit limit named only "every key"; `aiddTask` and `aiddDeclaredAt` alone, or a removed stamp, also declare | limit widened in the usage contract and the task contract |
| S2 | suggestion | decision 2 said "when present"; an empty stamp counts as absent | "when present and non-empty" |
| S3 | suggestion | "a declared branch is never asked again" without the `-C`/`-M` case | qualified in the usage contract, README, hook header and decision 6 |
| S4 | suggestion | round 5 resolutions named no commit | c7ae6e38 added |
| S5 | suggestion | keep the reporter output of gate runs | noted for the next runs |

The resolutions are wording only, applied after the approval (no code changed).
