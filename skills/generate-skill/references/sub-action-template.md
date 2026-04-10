# Sub-action template

Use this template for every file in `sub-actions/`.

Filename convention: `NN-kebab-case-slug.md` where NN is the two-digit sequence number.
Same sequence number = parallel execution by independent sub-agents.

```markdown
# SA-<NN>: <Sub-action name>

<One sentence: what this sub-action accomplishes.>

## Instructions

<Step-by-step. Imperative form. Each step starts with a verb. No ambiguity.>

1. <Step>
2. <Step>
3. <Step>

## Input / Output

- **Input**: <What this sub-action receives. Describe shape: fields, types, example.>
- **Output**: <What it produces. This is what the test policy verifies.>

## References

- Read `references/<topic-a>.md` for <what documentation to consult>.
- Read `references/<topic-b>.md` for <what documentation to consult>.

## Test policy

- **Assertion**: <Binary check. Machine-verifiable. Example: "File at output.file_path exists AND size > 10KB AND extension is .pdf">
- **Exit condition**: <The explicit, unambiguous condition that MUST be true for the sub-action to be considered done. No interpretation needed. Example: "HTTP 200 from POST /api/invoices AND response body contains field `id` with a non-empty string.">
- **Expected result**: <What the orchestrator receives on success. Example: "{ file_path, original_name, vendor }">
- **Retry loop**: <How to retry until the exit condition is met. Specify: max attempts, delay between retries, what to change between attempts, and the hard stop. Example: "Loop up to 5 times, 10s delay. On each retry, re-read the source and re-run the transformation. Hard stop after 5 failures: report the last error to the user.">
- **On failure**: <What happens when the retry loop is exhausted. Describe the fallback behavior plainly — e.g., "Try searching Gmail for the invoice instead. If that also fails, report the error to the user with the vendor name and period.">
```

## Guidelines

- A sub-action must be **atomic**: one operation, one assertion. Two assertions = two files.
- A sub-action must be **stateless**: input + skill context in, output out. No side-channel communication between sub-action instances.
- A sub-action must be **self-contained**: a sub-agent reading only this file plus any referenced `references/` files has everything it needs.
- **Transversal rules from the parent SKILL.md apply automatically.** The sub-agent executing this file must also read the parent SKILL.md's transversal rules section. A sub-action can override a transversal rule by declaring a local rule in its instructions — local scope wins.
- The test policy is **declarative**, not executable code. Describe the condition and the behavior in plain language. The executing agent interprets it.
- The **exit condition** must be a single, unambiguous boolean expression. If you can't write it as one sentence with AND/OR, decompose the sub-action.
- The **retry loop** is designed for the executing agent to run repeatedly until the exit condition is met. Always specify a hard stop (max attempts) to prevent infinite loops.
- Instructions are written as if speaking to a capable agent that has never seen this workflow before. Assume nothing implicit.
