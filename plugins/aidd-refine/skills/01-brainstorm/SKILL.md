---
name: 01-brainstorm
description: Interactive brainstorming session to clarify and refine requests through iterative questioning. Use when user mentions unclear requirements, vague ideas, or needs clarification on features. Do NOT use for clear technical specs, implementation details, or when requirements are already well-defined.
argument-hint: capture-request | ask-probing-questions | integrate-answers | refine-and-validate | confirm-approval
---

# Brainstorm

Clarifies and refines a feature request through structured iterative questioning until no ambiguity remains. Auto-triggers on prompts indicating uncertainty or need for clarification.

## Available actions

| #   | Action              | Role                                          | Input              |
| --- | ------------------- | --------------------------------------------- | ------------------ |
| 01  | `capture-request`   | Detail initial request in bullet points       | user intent        |
| 02  | `ask-probing-questions` | Ask questions to challenge assumptions     | captured request   |
| 03  | `integrate-answers` | Update request with user responses           | answers + request  |
| 04  | `refine-and-validate` | Finalize and check for ambiguity            | updated request    |
| 05  | `confirm-approval`  | Wait for user approval                       | refined request    |

## Default flow

Sequential skill: `01 → 02 → 03 → 04 → 05`. Loop `02 → 03` until no ambiguity (router checks `03` output for `needs_more`).

## Transversal rules

- Never assume technical solutions upfront.
- Use bullet points for clarity.
- DO NOT IMPLEMENT ANYTHING.
- Wait for user response after questions or approval prompts.

## References

- `@references/ambiguity-detection.md`: How to identify and resolve unclear requirements.

## Assets

- `@assets/question-templates.md`: Reusable probing question categories.

## External data

- None.