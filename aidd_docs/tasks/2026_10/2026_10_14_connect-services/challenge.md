**Verdict:** READY
**Scope:** Service access verification extracted from `02-project-memory` into `aidd-context:13-access-check`, the recipe reworked after the 2026-10-15 review, and onboarding ending its foundations with the check.
**Evidence limits:** The skill was run by hand against this repository's memory on 2026-10-20, re-run 2026-10-28; MCP, `http` and `web` probes were not exercised, this bank has command edges only. Client guide URLs checked 2026-10-20.

## Verified

- **Scope:** `02-project-memory/` is identical to `origin/next`; access checking is a separate, read-only skill whose service list comes from `ecosystem.md`, never from the recipe.
- **Placement:** No file of `13-access-check/` links outside it; the recipe names the skill by slash command only.
- **Live run:** One row per `Agent` edge of this bank, `Human` and `App` edges skipped:

  | Tool | Mode | Account / target | Status | Evidence / next step |
  | --- | --- | --- | --- | --- |
  | GitHub | `gh` | `alexsoyes` / `ai-driven-dev/framework` | ✅ | `gh repo view` read the repo |
  | Roadmap board | `gh` | `alexsoyes` / `ai-driven-dev` org project 8 | ✅ | `gh project view 8 --owner ai-driven-dev` read "AIDD Roadmap" |
  | GitHub Discussions | `gh` | `alexsoyes` / `ai-driven-dev/framework` | ✅ | `gh api graphql` read 7 discussions |

  Run 2026-10-28 by a fresh session following the skill, after the bank dropped the edge to the AI host and the `Human` edges its rules drop, added `Agent -- gh --> Discussions`, and `vcs.md` and `backlog.md` named the repository and the board owner. No account is recorded: the bank is shared, so any contributor's account passes.

- **Empty bank:** A directory without `aidd_docs/memory/` stops at Require with `/aidd-context:02-project-memory`, no file written.
- **Recipe:** CLI, MCP, API and SDK each have one example; none targets a service whose CLI the recipe lists; tokens come from the environment; five client MCP guides answer 200.

## Blockers

None.

## Suggestions

None.
