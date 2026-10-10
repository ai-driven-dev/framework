# Scope frame

The fields a scoped skill must define.

- subject:
- purpose: one sentence.
- name: kebab-case.
- flow: visible user journey.
- mode: optional, `auto` or `interactive`.
- placement: for Kilo, confirmed native or explicitly agreed portable; omit for other tools.
- target: detected tool, plugin source, or dedicated tool.

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
- placement: omit when not applicable.
