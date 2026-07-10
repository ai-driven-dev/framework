# Screen map

The state class picks the screen.

```mermaid
stateDiagram-v2
  [*] --> greenfield: no code, no memory
  [*] --> existing: code present, memory missing
  [*] --> drift: a foundation is ⚠
  [*] --> midwork: a dev-flow step pending
  [*] --> idle: all clear
```

| State class | Screen                                                          |
| ----------- | -------------------------------------------------------------- |
| greenfield  | welcome + foundations, **stack first** (3 steps)               |
| existing    | welcome + foundations, **memory first** (2 steps, stack skipped) |
| drift       | welcome + the warning-with-fix                                 |
| midwork     | where-you-are on the flow + the next step                      |
| idle        | welcome + the flow (walk or SDLC), or the idle menu            |
