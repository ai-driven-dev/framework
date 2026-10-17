---
status: done
---

# A declaration comes only from the command

## Need

The product rule ([usage-contract](../../../product/usage-contract.md#attribution)): a task and a ticket come only from `aidd telemetry task`. The R1 telemetry audit found two ways around it, and one sentence of the contract that the hook does not do.

| Finding | Observed |
| --- | --- |
| B1 | Both readers of a branch declaration (CLI `parseBranchConfig`, hook `lib/git.cjs` + `lib/binding.cjs`) bind a branch on a hand-set `aiddTask` with no `aiddDeclaredAt`. Attribution treats a snapshot with `declared_at: null` as speaking from the branch's creation. |
| B1 | `git branch -c A B` copies every `branch.A.*` key, `aiddDeclaredAt` included: B inherits a declaration it never received, and its calls go to A's task. |
| M8 | The contract says the gate "asks once per working branch". It blocks every prompt until the branch is declared. |

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | The command also writes `branch.<name>.aiddDeclaredFor = <name>`, before `aiddDeclaredAt`, which stays last. | Ties the declaration to the branch it was made on. A copy or a rename moves the keys under another name; the value keeps the old one. |
| 2 | A branch is declared only when `aiddDeclaredAt` is set and `aiddDeclaredFor`, when present and non-empty, equals the branch read. Otherwise it is undeclared: no task, no ticket, no `none`. | `aiddDeclaredAt` is the last key the command writes, so it alone says the command finished. The stamp rejects a copied declaration. |
| 3 | A declaration with no `aiddDeclaredFor` (written by cli-v5.5.0 and earlier) is read as before, if `aiddDeclaredAt` is set. Declaring again stamps it. | Beta, but data written by a released CLI keeps its meaning. Rejecting it would make `status` and the gate ask again on every branch already declared, for a hole only a copy opens. |
| 4 | `git branch -m A B` leaves B undeclared (a stamped declaration; see the limits for an unstamped one): the gate asks on B, and one declaration on B covers it from when it took the name B. Calls made on A keep A's task. | git moves the config keys the same way for a copy and a rename, so the stamp cannot tell them apart; the reflog could, but its entries expire, and a declaration that holds only while an entry lasts would change meaning on its own. The cost is one question after a rename, and nothing is lost: calls on B all come after B took its name. This replaces "follows a rename" in the usage contract. |
| 5 | A branch snapshot with `declared_at: null` attributes nothing. | Such a snapshot comes only from keys set by hand or a declaration cut short: every release wrote `aiddDeclaredAt`. |
| 6 | M8: the doc is wrong, not the hook. The gate blocks every prompt on an undeclared working branch until it is declared (or declared `--none`). A declared branch is never asked again, unless a copy or rename onto it changes its keys. | The spec that introduced the gate (`2026_10_09_deterministic-tokens/spec.md`) requires asking "before any token of that work is spent", and its target (`context/target.md`, "When to ask") re-checks every prompt. "Once" meant "remembered once answered". Letting later prompts through would spend tokens unattributed and need per-branch state. |
| 7 | A branch with any declaration key listed twice is undeclared, and the command replaces every value of a key (`--replace-all`, `--unset-all`). Added after review rounds 1 and 2. | `git branch -C` or `-M` onto an existing branch keeps both sets of keys: reading the last value of each mixed the copied declaration into the branch's own (a ticket or task the own one never set), and a plain `git config` set refuses a key with two values, so declaring again failed. |
| 8 | A branch's start is the newest reflog entry where it took its name by a copy or a rename (git's `Branch: renamed|copied`, libgit2's `branch: renamed`), else its oldest entry. Added after review rounds 3 and 4. | A copy or a rename brings the source's reflog, so the oldest entry is the source's creation. On a name used before, that made the older branch's declaration look newer than the one made after the copy, and the report kept it while `status` and the gate showed the new one. |

## Limits (stated, not fixed)

| Limit | Why it stays |
| --- | --- |
| Hand edits of the keys declare a branch: every key including the stamp, `aiddTask` and `aiddDeclaredAt` alone (read as unstamped), or a stamp removed or emptied. | git config is the person's own; no reader can tell who wrote a key. |
| A copy or a rename of an unstamped (legacy) declaration is inherited until the new name is declared again. | Decision 3. |
| Calls on a name used before, after a copy, rename or recreation and before it is declared again, still go to the earlier generation's declaration in the report. | A branch with no declaration takes no snapshot; only calls the gate did not hold can land there. Usage contract, residual limits. |
| A rename or copy entry expired from the reflog before the first declaration: the oldest remaining entry is the start. | Same class as any reflog expiry. Usage contract, residual limits. |
| Snapshots recorded before this change (a copied branch, a hand-set task with a `declared_at`) keep attributing. | Attribution reads only snapshots; `branches.jsonl` is append-only and its format is unchanged. |

## Acceptance

| # | Criterion |
| --- | --- |
| 1 | Sandboxed e2e: declare on A, `git branch -c A B`, calls on B: `report --axis ticket --json` does not give B's calls A's ticket. |
| 2 | Sandboxed e2e: `aiddTask` set by hand without `aiddDeclaredAt`: the branch's calls are `no-binding`. |
| 3 | Sandboxed e2e: after `git branch -m A B`, B's calls are `no-binding`; declaring on B attributes them. |
| 4 | Sandboxed e2e: an unstamped declaration with `aiddDeclaredAt` still attributes. |
| 5 | The hook applies the same rule, tested in `scripts/__tests__/` through real git, from the shared fixture both readers run. |
| 6 | `forget` removes `aiddDeclaredFor`. |
| 7 | Each guard is shown by a mutation that turns its test red. |
| 8 | The usage contract, the CLI telemetry memory, the plugin README and skill say decisions 1 to 6 and the limits. |
