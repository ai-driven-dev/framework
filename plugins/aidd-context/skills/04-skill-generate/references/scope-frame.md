# Scope frame

The fields a scoped skill must define.

- subject:
- purpose: one sentence.
- name: kebab-case.
- flow: visible user journey.
- mode: optional, `auto` or `interactive`.
- target: detected tool, plugin source, or dedicated tool.
- Kilo placement: native `.kilo/skills/` by default; portable `.agents/skills/` only after explicit user choice.

Modes:

- `auto`: runs through the flow without planned user checkpoints.
- `interactive`: pauses for user input at defined checkpoints.

Output shape:

- subject:
- purpose:
- name:
- flow:
- mode: omit when absent.
- target:
