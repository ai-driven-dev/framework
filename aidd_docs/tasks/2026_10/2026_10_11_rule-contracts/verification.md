# Five-host rule contract verification, 2026-10-11

The five publication formats match current official documentation. Current native input captures establish loading/retrieval and lifecycle behavior for four hosts; Cursor's current Free quota blocks its native consumer. This is not a complete five-host model-enforcement pass. [Official contracts and sources](official-contracts.md).

Starting revision: `303e17a1ba995dd19ec769381f7bbb594fbd1d7c`. The production writer is unchanged, SHA-256 `70783e579b75b9e22760239cbfd4309641bdd73840b17e7dfd606a252679a420`. At verification completion on October 11, all changes were local, without a commit or push. Subsequent publication and CI results are tracked in [PR #979](https://github.com/ai-driven-dev/framework/pull/979).

## What changed

The skill reference now corrects the Codex byte-budget claim: global/home instructions are assembled separately from the project-document counter in both verified versions. It also states session refresh requirements, Claude project settings, Cursor product limits and the absence of cross-host glob grammar validation. The writer's conservative local size guard and generated formats are unchanged.

Two new rule tests parse native YAML with the existing independent `js-yaml` dependency. They verify scoped/global metadata, quoting, Unicode, exact CRLF body preservation and absence of accidental AGENTS publication for native-only targets. No production dependency was added.

The remote CodeQL check subsequently reported three filesystem race alerts and seven unused variables in reproduction scripts. The shared reader now opens with `O_NOFOLLOW | O_NONBLOCK`, validates the opened descriptor with `fstat`, reads that descriptor and closes it in `finally`. Ownership-marker and snapshot reads use the same helper; snapshots preserve symbolic links through `readlink`. This fixes the local cause rather than suppressing the analyzer. Eight regression tests cover pathname replacement, symlink/nonregular refusal and descriptor closure. [RED/GREEN report](evidence/security-report.json), [initial failure](evidence/security-red.tap), [passing tests](evidence/security-green.tap).

Three deliberately broken copies independently fail their intended tests: reading by pathname after descriptor validation, omitting descriptor closure, and following symlinks. These are executed only in disposable copies, not in the framework. [Mutation receipts](evidence/security-mutations/results.json).

## Repository and realistic installation

Final guarded repository run: **623 tests pass, no failures, cancellations or skips**. This includes 61 rule-generation tests and eight reproduction-file security tests. [Full log](evidence/root-tests.log).

```sh
node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'
```

The fresh sandbox after the security correction covers six invoice/API projects: five individual hosts and mixed targets. Real CLI installation/translation delivers ten writers matching the production hash. The cycle exercises 78 installed-script invocations, manual canonical edits, publication, repeat idempotency, retargeting and deletion. All 54 application tests and the nine initial baseline tests pass. Twelve adversarial cases refuse with existing project bytes unchanged, including symbolic-link targets/sources. Five doctor/sync/remove commands exit zero and preserve application/user rules while removing the installed plugin script. [Results](evidence/sandbox/reproduction-results.json), [lifecycle](evidence/sandbox/lifecycle-results.json), [refusals](evidence/sandbox/negative-results.json), [cleanup](evidence/sandbox/cleanup-results.json).

```sh
node aidd_docs/tasks/2026_10/2026_10_09_autonomous-rule-generation/realistic-sandbox/reproduction/run.cjs --repo "$PWD"
```

Distribution proves installation and execution of delivered assets. Flat translation does not by itself prove native skill activation. The framework CLI source remains unchanged from `12777d03`.

## Current native input captures

The new [runtime reproduction](run-runtime.py) requires Python 3 and POSIX descriptor/process-group APIs; it was exercised on macOS. It physically copies the skill, creates owned temporary projects and profiles, invokes supplied real host binaries and records HTTP request bodies. Providers are configured exclusively to ephemeral loopback servers returning fixed text/tool calls, with fake keys or authentication disabled. No subscription auth is copied into these captures. This proves observed host input and tool behavior, not semantic compliance by a real model or operating-system-wide network confinement.

All **14 sessions and 25 HTTP requests** pass the declared assertions. Complete current bodies reach context, old bodies disappear after update, generated text disappears after deletion, and the original CRLF AGENTS bytes return exactly. [Checks](evidence/runtime/checks.json), [commands](evidence/runtime/operations.json), [candidate identity](evidence/runtime/candidate.json).

- **Claude Code 2.1.295:** eight fresh sessions. Global rules load at startup. Scoped bodies are absent before the actual Read, then present only for the matching domain or documentation file. Both shallow and nested domain files match. Update loads the complete new body and omits old text; deletion removes every generated marker. Excluding the project settings source omits project rules even after a matching Read.
- **Codex 0.162.1:** create/update/delete each exit zero with one captured Responses request. Root AGENTS guidance includes all three scopes, confirming in-file conditions rather than native filtering.
- **OpenCode V2 2.0.22:** create/update/delete each exit zero with two captured Chat Completions requests. Generated guidance appears in the second request after create/update and in neither after deletion. The independently present file named only by config.instructions is absent throughout, confirming that configuration field does not resolve its content in this version.

Reproduce with absolute paths for the installed binaries:

```sh
python3 aidd_docs/tasks/2026_10/2026_10_11_rule-contracts/run-runtime.py \
  --repo /path/to/framework --node /path/to/node \
  --claude /path/to/claude --codex /path/to/codex --opencode /path/to/opencode2
```

The lower-level capture refuses projects without this runner's temporary ownership marker; its OpenCode mock configuration therefore cannot overwrite an unrelated project configuration. Review found two harness gaps, now repaired: nonregular ownership markers are rejected before any output mutation (FIFO refusal in 0.085 seconds), and a timeout kills the launched process group. A real forking control confirms that both wrapper and child disappear, with completion in 1.583 seconds. [Harness controls](evidence/harness-guards/checks.json).

## Copilot scoped discovery and retrieval

**Copilot CLI 1.0.83:** 18 successful fresh native sessions, 40 captured requests through its documented offline BYOK provider. Global OLD/NEW bodies load exactly once, update omits OLD, and deletion removes every generated body and scoped index entry. All original 378-byte AGENTS buffers are preserved. [Report](evidence/copilot/REPORT.md), [audit](evidence/copilot/audit.json), [indexed files/hashes](evidence/copilot/index.json).

Reading an application file alone does not attach its scoped rule body in these captures. The index lists exact applyTo patterns and native paths even outside scope. Four initial automatic-body expectations remain false in their recorded summaries. In separate controls, the simulated model selects the matching path from that actual index and calls the real view tool: the following request includes the complete matching native body, with the unrelated body absent. All nine explicit-retrieval controls pass.

This establishes discovery and retrieval, rather than claiming automatic attachment, natural selection by a real model, edit-triggered behavior or scope enforcement. The preserved false controls are not reclassified as a five-host pass.

## Cursor current quota boundary

**Cursor Agent 2026.10.01-e373342:** official metadata and CLI-loading contracts match the generated format. An isolated endpoint probe reaches local authentication exchange, then stops on the controlled server error before any rule content. This is routing evidence only. [Endpoint receipt](evidence/cursor/summary.json).

Fresh read-only account checks establish the current Free plan, paid premium requests disabled and zero paid hard limit. The disabled usage counter's zeros do not establish an exhausted Free quota. A separate native Auto consumer is therefore attempted under the existing subscription; it exits one after 6.83 seconds with `You've hit your usage limit`, before any assistant tool call or new domain function. No retry, upgrade or fallback follows. Current native update, outside-scope and deletion conversations are not run after this refusal. [Current quota](evidence/cursor/quota-current.json), [native attempt and preservation](evidence/cursor-native/REPORT.md).

Real CLI flat installation succeeds and delivers the exact current writer; deterministic native MDC creation succeeds and the nine application tests pass. The installed session-start memory hook legitimately updates only its own AGENTS memory block (378 to 304 bytes); guidance outside that block remains byte-identical. This change is not attributed to the rule writer, and the native attempt does not claim whole-file AGENTS preservation.

## Review and remaining limits

[Independent review](review.md) evaluates current code and archived receipts. [Evidence index](evidence/index.json) binds archived file bytes and hashes. Historical subscription-model journeys in the October 9 task retain their old writer hash and are not relabeled as current all-host model tests.

At verification completion, local checks passed, but **remote CodeQL remained failed on the previously pushed revision**: [check run](https://github.com/ai-driven-dev/framework/runs/113740545599). Its analyzer still needed to run against the corrected scripts after an authorized push. Other branch checks passed; their success did not validate the then-unpushed changes. No local CodeQL executable was available.

No complete current Cursor native journey, universal glob matcher, deterministic model obedience, Linux/Windows native-host claim, cross-surface context deduplication, concurrent-writer guarantee or multi-file disk-failure rollback is established. These remain explicit boundaries rather than inferred passes.
