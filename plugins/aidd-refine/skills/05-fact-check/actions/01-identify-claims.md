# 01 - Identify claims

Extract every verifiable factual claim from the target text and classify each one.

## Inputs

- `target_text` (required) - string, the text whose facts must be checked. The user's prior answer, a quoted passage, or an explicitly pasted block.

## Outputs

A claim list. Each entry pairs the claim text with one category from the locked taxonomy.

```json
[
  { "claim": "Next.js 15 shipped the use cache directive in 2024", "category": "version" },
  { "claim": "the file aidd_docs/memory/architecture.md exists in this repo", "category": "project-fact" }
]
```

## Process

1. Read `target_text` sentence by sentence.
2. For each sentence, decide: does it assert a fact? Split a mixed sentence into its factual part and its opinion part.
3. Drop every non-claim per `@${CLAUDE_PLUGIN_ROOT}/skills/05-fact-check/references/claim-categories.md` - opinion, preference, trivially-known general knowledge, the AI's own intent.
4. Assign each surviving claim exactly one category from the locked taxonomy. When two categories fit, prefer the one routing to the cheapest tier (`project-fact` over `hard-to-know` for repo claims).
5. Emit the claim list. If the list is empty, report "no verifiable claims" and stop the skill.

## Test

Run on the text `"Next.js 15 shipped the use cache directive in 2024. This naming is clean."` - the output lists the first sentence as a claim (category `version` or `date-event-person`) and excludes "This naming is clean" as opinion.
