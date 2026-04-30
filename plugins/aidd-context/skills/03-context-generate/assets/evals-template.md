# Evaluation scenarios template

`evals/scenarios.json` holds the evaluation suite for the skill. It is written BEFORE any action is implemented (strict TDD per R11).

## Schema

```json
[
  {
    "type": "should",
    "prompt": "A user prompt that MUST trigger this skill",
    "expect_action": "slug-of-the-action-to-dispatch",
    "note": "Optional rationale"
  },
  {
    "type": "should_not",
    "prompt": "A prompt that looks similar but MUST NOT trigger this skill",
    "expect_action": null,
    "competing_skill": "name-of-the-skill-that-should-handle-it-instead",
    "note": "Optional rationale; use 'none' if no competing skill exists"
  },
  {
    "type": "ambiguous",
    "prompt": "A borderline prompt where clarification is needed",
    "expect_action": "ask_clarification",
    "note": "What the skill should ask the user"
  }
]
```

## Rules

- ≥ 3 `should`, ≥ 3 `should_not`, ≥ 1 `ambiguous` (R10).
- Prompts must be realistic — copy phrasings users would actually type, in their natural language.
- No trivial variations of the same prompt. Each scenario must exercise a distinct decision.
- Every `expect_action` in `should` scenarios must map to a real action slug that will exist after action 03.

## Concrete example (hypothetical `slack` skill)

```json
[
  {
    "type": "should",
    "prompt": "Post this update to #engineering",
    "expect_action": "post-message"
  },
  {
    "type": "should",
    "prompt": "Get the last 20 messages from #product",
    "expect_action": "get-history"
  },
  {
    "type": "should",
    "prompt": "Create a private channel called incident-2026-04",
    "expect_action": "create-channel"
  },
  {
    "type": "should_not",
    "prompt": "Send an email to the team",
    "expect_action": null,
    "competing_skill": "gmail"
  },
  {
    "type": "should_not",
    "prompt": "Post this on Discord",
    "expect_action": null,
    "competing_skill": "discord"
  },
  {
    "type": "should_not",
    "prompt": "Open a ticket in Linear",
    "expect_action": null,
    "competing_skill": "linear"
  },
  {
    "type": "ambiguous",
    "prompt": "Notify the team",
    "expect_action": "ask_clarification",
    "note": "Ask which channel and whether to @-mention anyone"
  }
]
```
