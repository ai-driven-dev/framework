# 02 - Write rule

## Input

Approved capture.

## Output

Files or refusal.

## Process

1. Host create/update: serialize approved JSON outside destinations per [publication](../references/rule-publication.md).
2. Invoke installed absolute writer per publication. Plugin: directly write/delete approved source only; no fan-out.
3. Record results; stop on verbatim refusals.

## Rules

- Preserve approved capture exactly. Never regenerate, edit canonical metadata or generated outputs manually, migrate legacy rules or bypass refusals.
