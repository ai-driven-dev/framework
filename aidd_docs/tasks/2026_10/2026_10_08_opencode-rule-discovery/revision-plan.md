---
status: in-progress
---

# Autonomous rule generation

## Source and authority
The user rejected the mandatory CLI dependency in the initial candidate, accepted a deterministic script bundled inside the rule-generation skill, and asked to remove the mechanism from the CLI. The user then explicitly selected all five hosts for this PR. The revised contract and delivery plan are in [autonomous rule generation](../2026_10_09_autonomous-rule-generation/plan.md).

The initial contract and reports describe commit 4ca83525 only and do not validate this revision. The user's contract change reopens SDLC Frame, Deliver and Check. The existing draft PR #979 will describe the final revised candidate.

## Phase 1: remove the CLI mechanism
- Restore only CLI files introduced or modified by 4ca83525 to the pinned base 12777d03. Preserve any later unrelated edits if discovered; do not use an unpinned remote branch as the restoration source.
- Remove the added publication command, formatter, capability, lifecycle integration and tests, as well as the related documentation and bundle budget increase.
- Preserve the original framework rule-inventory command and all unrelated CLI behavior.
- Leave the user's .gitignore and .hermes.md untouched.
- Verify that the CLI source/config/tests/budget match the pinned base. Do not stage, commit or push in the executor.

## Phase 2: autonomous generation
The five-host implementation follows the new plan. The script is packaged inside plugins/aidd-context/skills/05-rule-generate/scripts, uses only Node built-ins, and resolves its runtime relative to the installed skill rather than the project or framework checkout. Knowledge production stays in aidd-context. Native syntax adapters and shared write validation must not introduce a dependency on CLI code.

## Phase 3: validation and independent Check
Tests must prove actual standalone script execution from a copied installed skill, native rendering of confirmed targets, safe prospective updates and preservation of user guidance. Re-run repository guards and distribution checks, then verify real OpenCode V2 model input after all other validations. The same independent checker reviews and challenges the revised contract and candidate before VCS delivery.
