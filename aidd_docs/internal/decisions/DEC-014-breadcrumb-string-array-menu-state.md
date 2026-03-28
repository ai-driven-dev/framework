# Decision: string[] breadcrumb as menu loop state

| Field   | Value                  |
| ------- | ---------------------- |
| ID      | DEC-014                |
| Date    | 2026-03-28             |
| Feature | interactive-menu       |
| Status  | Accepted               |

## Context

After spawning a CLI command, `runMenuLoop` in `cli.ts` creates a new `InteractiveMenuUseCase` instance. The call stack is gone — there is no way to return to the previous menu level without an explicit state token.

## Decision

`InteractiveMenuResult` carries `returnTo?: string[]` — the breadcrumb path from root to the node that was active when the command was selected. `runMenuLoop` passes it as `startAt` on the next iteration. `navigateFrom` walks the tree to that node before showing any prompt.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Typed enum `MenuStartAt` | Compile-time safety | Hardcoded depth; breaks at 3+ levels | Doesn't scale with recursive tree |
| Re-show root menu always | Simple | Bad UX — user loses context | UX regression |

## Consequences

- `returnTo: string[]` scales to any tree depth without type changes
- Empty `returnTo` (root-level command) resumes at root — correct for `setup`
- `returnTo = undefined` on error resets to root safely
