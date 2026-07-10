# Tiers

How a step runs. The tier is a default, overridable.

| Tier   | What                    | How onboard runs it                                        |
| ------ | ----------------------- | ---------------------------------------------------------- |
| AUTO   | non-interactive         | invoke, run to completion, continue                        |
| GUIDED | interactive Q&A         | launch, hand to the user, resume on return (see `return.md`) |
| MANUAL | side-effecting, outward | show the command, run nothing, leave it for the user       |

- Rendered as a plain clause, never a glyph: AUTO `(runs on its own)`, GUIDED `(it will ask you a few questions)`, MANUAL `(you run this one yourself)`.
- The tier is a default. A dual-mode skill (interactive by default, unattended on request, e.g. `aidd-dev:00-sdlc`) runs the other way when the user asks and the skill supports it.
- `OK` walk: AUTO to completion, GUIDED pauses then resumes, MANUAL shown and left. State up front how many steps and which need input.
