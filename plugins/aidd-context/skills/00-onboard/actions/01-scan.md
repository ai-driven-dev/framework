# 01 - Scan

Read the project into a snapshot.

## Input

The project root.

## Output

One silent snapshot: check statuses, detected AI tools with wiring, installed skills, and the project brief when memory is synced.

## Process

1. **Zones.** Evaluate the checks per `@../references/state/zones.md`.
2. **Detect.** Resolve AI tools and wiring per `@../references/state/detection.md`.
3. **Ledger.** Drop done steps per `@../references/state/done-rule.md`.
4. **Hedge.** If a plan exists, pin the build-to-ship stage per `@../references/state/hedge.md`.
5. **List.** Gather installed AIDD plugins and skills via native discovery.
6. **Hold.** Hand the snapshot to `02-assess`, printing nothing.

## Test

- Scan prints nothing.
- The snapshot carries a status per check, the detected AI tools with wiring, and the installed skills.
- A ledgered step and a cross-branch PR never enter the snapshot's actionable set.
