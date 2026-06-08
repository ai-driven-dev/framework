# 04 - Pick and design

User picks winning candidate (informed by audit). Fill checklist block 4 with concrete stack choices. Architecture pattern + folder tree decided next, in action 05.

## Inputs

- Augmented comparison table from action 03 (verdicts + rationale).
- Filled checklist blocks 1-3.

## Outputs

Checklist with **block 4 stack items filled** (front, back, DB, auth, final hosting). Architecture-pattern item left for action 05.

## Depends on

- `03-audit-candidates`

## Process

1. Print action 03 augmented table. Ask user to pick a candidate by letter (A / B / C).
2. If picked candidate verdict `⚠️`: surface audit concerns directly - list specific risks found in action 03, ask whether user has mitigation plan, loop until satisfied or candidate switched.
3. If picked candidate verdict `❌`: refuse pick, loop back to let user choose differently. (Do not proceed with known-broken stack.)
4. Fill block 4 stack items (front, back, DB, auth, final hosting) with picked candidate's concrete choices. Leave architecture-pattern item empty - action 05 decides it. Show user filled stack choices, ask them to confirm "go".

## Test

Block 4's five stack items (front, back, DB, auth, hosting) filled, no remaining `<...>` placeholders, architecture-pattern item still empty, user confirmed stack in writing.
