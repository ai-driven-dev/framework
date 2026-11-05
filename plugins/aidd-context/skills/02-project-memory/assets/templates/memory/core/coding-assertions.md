# Coding Assertions

The checks that must pass for code to count as done. Minimal, run after every change.

## Before commit

The fast gate.

| Order | Command     | Checks           |
| ----- | ----------- | ---------------- |
| 1     | `<command>` | <e.g. typecheck> |

## Before push

The heavier gate.

| Order | Command     | Checks              |
| ----- | ----------- | ------------------- |
| 1     | `<command>` | <e.g. tests, build> |

## Behavior

If a fix is needed, spawn an agent per failing assertion (e.g typechecking, tests, rules violated on category UI).

<!--
Capture: the real commands a contributor runs, in order, for each gate.
Skip: aspirational checks not wired up. List only what actually exists.
Remove this comment when filled.
-->
