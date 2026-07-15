---
name: <skill-name>
description: <Verb-led, what the skill produces, one clause>. Use when the user wants to <distinct intents>. <Optional: "Not for <X>" in plain words when a sibling could mis-trigger.> (Two lines max, ~240 chars, straight to the point. Third person, no XML. Never name another skill, never write a /command token. All "when" lives here, not in the body.)
argument-hint: <slug-1 | slug-2> # action slugs, or the user's cases when actions are not all entry points; omit for one action
---

# <Skill Name>

<1 sentence: what running this skill produces.>

```mermaid
flowchart LR
  <a --> b --> c>
```

## Actions

Run the flow above. Read an action's file in `actions/` before running it.

| #   | Action   | Does            |
| --- | -------- | --------------- |
| 01  | `<slug>` | <one-line verb> |

<Optional, if it delegates: `Spawn the `<agent>` agent to run this skill.`>

## Transversal rules

<Rules applying to every action that are NOT already owned by a reference. One idea per line.>

- <rule>

<!--
OPTIONAL sections below. Include a section ONLY when it has content (R9); never write an empty section or a "None." placeholder. Delete this comment and any section you do not use.

## References    documents the actions READ (conventions, schemas, lookup tables).
Flat when there is no load boundary. Group one directory deep when a set of files is pulled by one path (R3): `references/<group>/<file>.md`, e.g. `references/state/zones.md`. List ONLY global includes; an action-specific include lives with its action and carries that action's slug prefix (R13).
- `references/<file>.md`: <what it covers>

## Assets       files the actions COPY or INJECT (templates, fixed snippets).
List ONLY global includes. An action-specific include lives with its action and carries that action's slug prefix (R13).
- `assets/<file>`: <what it provides>

## External data   data the skill depends on outside itself. Always point, never copy.
- `<relative/path>`: <what it provides>
-->
