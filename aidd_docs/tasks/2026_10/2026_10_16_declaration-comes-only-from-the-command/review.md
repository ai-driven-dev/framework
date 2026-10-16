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
