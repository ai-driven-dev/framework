# The AIDD flow curriculum

`03-present` loads this on a flow or walk screen. It teaches the feature flow and the two foundation paths. It is also the source of the `[map]` view.

## Foundations, two paths

The order is state-aware.

- **Existing project** (code present) — memory first, the stack is skipped:
  1. `project memory` — scan the existing code into a memory bank the AI reads.
  2. `connect it to the AI` — wire the memory into each used tool's context file.
- **Greenfield** (empty repo) — stack first:
  1. `design tech stack` — pick the technologies and architecture.
  2. `project memory` — record what the project is.
  3. `connect it to the AI` — wire the memory in.

## Feature flow, the eight steps

Each step, one line of what and why. `spec` is optional.

| Step         | What                                     | Why                                     |
| ------------ | ---------------------------------------- | --------------------------------------- |
| brainstorm   | turn a vague idea into something precise | a fuzzy idea makes every next step guess |
| spec*        | write the contract of what to build      | one agreed definition, no drift          |
| plan         | break it into phases                     | small units that ship and verify         |
| implement    | build it, phase by phase                 | verified phases beat one big leap        |
| assert       | check it behaves                         | catch breakage before review             |
| review       | a verdict before shipping                | ship or iterate, decided                 |
| commit       | save the work                            | an atomic, reversible record             |
| pull request | ship it                                  | open it for merge                        |

## Layouts

**Vertical, annotated** — the tutorial screen:

```txt
  brainstorm      turn a vague idea into something precise
      │
  spec            the contract of what to build          (optional)
      │
  plan            break it into phases
      │
  implement       build it, phase by phase
      │
  assert          check it behaves
      │
  review          verdict before shipping
      │
  commit          save the work
      │
  pull request    ship it
```

**Horizontal, compact** — the `[map]` view:

```txt
brainstorm → spec* → plan → implement → assert → review → commit → PR
(* optional)
```

## Run it

- `[1]` walk it with me — one step at a time, each explained.
- `[2]` let `aidd-dev:00-sdlc` drive the whole flow from one request.
