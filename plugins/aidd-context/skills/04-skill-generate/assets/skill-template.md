---
name: <skill-name>
description: <What the skill does, third person, one clause>. Use when <explicit, slightly pushy trigger phrases users actually type; the model under-triggers, so over-list>. <Optional: "Not for <X>, use <Y>" only when a sibling skill could mis-trigger.> (<= 1024 chars, third person, no XML tags; all "when" lives here, not in the body.)
---

# <Skill Name>

<1 sentence: what running this skill produces.>

## Actions

<One row per action: # | slug | one-line role | required input.>

| #   | Action   | Role            | Input   |
| --- | -------- | --------------- | ------- |
| 01  | `<slug>` | <one-line role> | <input> |

<Flow line, one concise sentence: a chain (`01 → 02 → 03`, test each before the next), or independent actions (the router runs the one matching the intent, or several together when asked).>
<Optional, if it delegates: `Spawn the `<agent>` agent to run this skill.`>

<!--
OPTIONAL sections below. Include a section ONLY when it has content (R9); never write an empty section or a "None." placeholder. Delete this comment and any section you do not use.

## References    documents the actions READ (conventions, schemas). Plain paths, no `@`.
List ONLY global includes (used skill-wide). An action-specific include lives with its action and carries that action's slug prefix (R13).
- `references/<file>.md`: <what it covers>

## Assets       files the actions COPY or INJECT (templates, fixed snippets).
List ONLY global includes (used skill-wide). An action-specific include lives with its action and carries that action's slug prefix (R13).
- `assets/<file>`: <what it provides>

## Transversal rules   rules applying to every action that are NOT already owned by a reference.
- <rule>

## External data   data the skill depends on outside itself. Always point, never copy.
- `<relative/path>`: <what it provides>
-->
