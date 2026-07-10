# 01 - Scan

Read the project into a snapshot.

## Input

The project root.

## Output

The project snapshot, printed nowhere.

## Process

1. **Zones.** Evaluate the checks per `@../references/state/zones.md`.
2. **Detect.** Resolve AI tools and wiring per `@../references/state/detection.md`.
3. **Ledger.** Drop done steps per `@../references/state/done-rule.md`.
4. **Hedge.** If a plan exists, pin the build-to-ship stage per `@../references/state/hedge.md`.
5. **List.** Gather installed AIDD plugins and skills via native discovery.
6. **Hold.** Keep the snapshot in context. Print nothing.

## Test

- Scan prints nothing.
- The snapshot carries a status per check, the detected AI tools with wiring, and the installed skills.
- A ledgered step and a cross-branch PR never enter the snapshot's actionable set.
