---
name: <skill-name>
description: <Verb-led, what the skill produces, one clause>. Use when the user wants to <distinct intents>. <Optional: "Not for <X>" in plain words when a sibling could mis-trigger.> (Two lines max, ~240 chars, straight to the point. Third person, no XML. Never name another skill, never write a /command token. All "when" lives here, not in the body.)
argument-hint: <slug-1 | slug-2> # REQUIRED for two or more actions. Independent actions: the slugs. A pipeline or loop: the user's cases, never the stage slugs, or omit for a single case. Omit entirely for one action.
---

# <Skill Name>

## Actions

<Flow schema. Strictly sequential: a one-line chain `<slug-1> → <slug-2> → <slug-3>`. Loops or branches: a mermaid flowchart instead. Never a mermaid for a plain sequence.> Run each action's `## Test` before the next. Read an action's file in `actions/` before running it. <A self-skip shows as the early exit in the flow, never by restating an action's condition or report.>

| #   | Action   | Does            |
| --- | -------- | --------------- |
| 01  | `<slug>` | <one-line verb> |

<Optional, if it delegates: `Spawn the `<agent>` agent to run this skill.`>

## Transversal rules

<Rules that apply to every action and are NOT owned by a reference or a single action. One idea per line. A rule stated here is never restated in an action (R6); a rule that governs one action lives in that action, not here.>

- <rule>

<!--
The router is the leanest file on any path (R4): it is read on every invocation, so it holds only the flow, the table, and the transversal rules. No intro sentence, no business logic.

OPTIONAL sections below. Include one ONLY when it has content (R9); never write an empty section or a "None." placeholder. Delete this comment and any section you do not use.

## References    documents the actions READ (conventions, schemas, lookup tables).
Flat when there is no load boundary. Group one directory deep when a set of files is pulled by one path (R3): `references/<group>/<file>.md`, e.g. `references/state/zones.md`. List a reference here ONLY when two or more actions use it. One used by a single action is cited from that action alone, slug-prefixed, and never listed here (R13).
- `references/<file>.md`: <what it covers>

## Assets       files the actions COPY or INJECT (templates, fixed snippets).
List an asset here ONLY when two or more actions use it. One used by a single action is cited from that action alone and never listed here (R13).
- `assets/<file>`: <what it provides>

## External data   data the skill depends on outside itself. Always point, never copy.
- `<relative/path>`: <what it provides>
-->
