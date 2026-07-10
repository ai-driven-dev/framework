# Screen map

The state class picks the screen.

| State class | When                         | Screen                                              |
| ----------- | ---------------------------- | --------------------------------------------------- |
| greenfield  | no code, no memory           | welcome + foundations, stack first (3 steps)        |
| existing    | code present, memory missing | welcome + foundations, memory first (2 steps)       |
| drift       | a foundation is ⚠            | welcome + the warning-with-fix                      |
| midwork     | a dev-flow step pending      | where-you-are on the flow + the next step           |
| idle        | all clear                    | welcome + the flow (walk or SDLC), or the idle menu |
