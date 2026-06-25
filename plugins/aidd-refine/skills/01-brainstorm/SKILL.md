---
name: 01-brainstorm
description: Clarify a vague idea through deep back-and-forth questioning until it is precise enough to act on. Works at any level, functional, technical, or mixed. Use when the user surfaces a half-formed idea, a fuzzy feature, a technical question, or an under-specified request, or asks to brainstorm, clarify, or refine before committing. Keeps probing and following each answer's threads until no real ambiguity remains or the user is satisfied. Not for analytically scanning a written artifact for gaps, critiquing finished work, or any implementation, planning, or code.
argument-hint: capture | probe | integrate | finalize
---

# Brainstorm

Turns a vague idea into a precise one through a deep, natural conversation. Each round asks pointed questions, follows the threads the answers open, and challenges assumptions, until the idea is clear enough to act on. It digs, it does not tick boxes.

## Actions

| #   | Action      | Role                                                       | Input               |
| --- | ----------- | --------------------------------------------------------- | ------------------- |
| 01  | `capture`   | Restate the idea and read its altitude                     | the user's idea     |
| 02  | `probe`     | Ask pointed questions, follow the open thread, challenge    | the idea so far     |
| 03  | `integrate` | Fold answers in, judge if real ambiguity remains           | answers + the idea  |
| 04  | `finalize`  | Consolidate, flag open assumptions, offer to persist       | the clarified idea  |

## Default flow

`capture` once, then loop `probe → integrate` until no real ambiguity remains or the user is satisfied, then `finalize`. There is no fixed round count, the idea is done when it is clear, not on a timer. Run each action's `## Test` before the next.

## Transversal rules

- Clarify the idea, never build it. Surface the leaning and its tradeoff when the facts point one way, but do not lock a solution, write a plan, or produce code.
- Stay tool-agnostic. Refine the idea on its own terms. Never write a `plugin:skill` identifier, name the capability in plain words instead (the project's rule-writing, its planning step), never the skill that provides it. How it gets built is the next step's job, not brainstorm's.
- Work at the user's altitude, functional or technical, and probe at that grain, never one level finer.
- Follow the thread. Pull on what each answer opens, especially a fork where two materially different builds are still possible, rather than cycling fixed topics. Depth over breadth.
- Challenge assumptions and surface limit cases as they appear, do not save them for the end.
- Ask a focused set of pointed questions, several when they share the thread, never a question already answered, never a flat checklist. Keep it a conversation.
- Keep going until the idea is clear or the user stops. Never stop on a count.
- Flag every open assumption, never present a guess as settled.
- Wait for the user after every question and at approval.

## References

- `references/probing.md`: how to read altitude, follow threads, the probing tactics, and when to stop.

## Assets

- `assets/question-angles.md`: concrete question prompts to draw from when probing.
