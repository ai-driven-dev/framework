# Command Inventory — Phase 0

## All Commands (find commands -type f -name '*.md')

37 commands total across 10 categories.

## Migration Mapping

| Source Path | Target Plugin | Target Skill | Bracket ID |
|---|---|---|---|
| `commands/00_behavior/auto_accept.md` | `aidd-dev` | auto-accept | [2.X] (TBD) |
| `commands/01_onboard/generate_agent.md` | `aidd-dev` | generate-agent | [1.1] |
| `commands/01_onboard/generate_architecture.md` | `aidd-dev` | generate-architecture | [1.2] |
| `commands/01_onboard/generate_command.md` | `aidd-dev` | generate-command | [1.3] |
| `commands/01_onboard/generate_rules.md` | `aidd-dev` | generate-rules | [1.4] |
| `commands/01_onboard/generate_skill.md` | `aidd-dev` | generate-skill | [1.5] |
| `commands/01_onboard/init.md` | `aidd-dev` | init | [1.6] |
| `commands/01_onboard/onboard.md` | `aidd-dev` | onboard | [1.7] |
| `commands/02_context/brainstorm.md` | `aidd-context` | brainstorm | [2.1] |
| `commands/02_context/challenge.md` | `aidd-context` | challenge | [2.2] |
| `commands/02_context/create_user_stories.md` | `aidd-context` | create-user-stories | [2.3] |
| `commands/02_context/ticket_info.md` | `aidd-context` | ticket-info | [2.4] |
| `commands/03_plan/components_behavior.md` | `aidd-context` | components-behavior | [3.1] |
| `commands/03_plan/image_extract_details.md` | `aidd-context` | image-extract-details | [3.2] |
| `commands/03_plan/plan.md` | `aidd-context` | plan | [3.3] |
| `commands/04_code/assert.md` | `aidd-dev` | assert | [4.1] |
| `commands/04_code/assert_architecture.md` | `aidd-dev` | assert-architecture | [4.2] |
| `commands/04_code/assert_frontend.md` | `aidd-dev` | assert-frontend | [4.3] |
| `commands/04_code/implement.md` | `aidd-dev` | implement | [4.4] |
| `commands/04_code/implement_from_design.md` | `aidd-dev` | implement-from-design | [4.5] |
| `commands/04_code/run_projection.md` | `aidd-dev` | run-projection | [4.6] |
| `commands/05_review/review_code.md` | `aidd-dev` | review-code | [5.1] |
| `commands/05_review/review_functional.md` | `aidd-dev` | review-functional | [5.2] |
| `commands/06_tests/test.md` | `aidd-dev` | test | [6.1] |
| `commands/06_tests/test_journey.md` | `aidd-dev` | test-journey | [6.2] |
| `commands/07_documentation/learn.md` | `aidd-context` | learn | [7.1] |
| `commands/07_documentation/mermaid.md` | `aidd-context` | mermaid | [7.2] |
| `commands/08_deploy/commit.md` | `aidd-vcs` | commit | [3.1] |
| `commands/08_deploy/create_request.md` | `aidd-vcs` | pull-request | [3.2] |
| `commands/08_deploy/tag.md` | `aidd-vcs` | release-tag | [3.3] |
| `commands/09_refactor/audit.md` | `aidd-dev` | audit | [9.1] |
| `commands/09_refactor/performance.md` | `aidd-dev` | performance | [9.2] |
| `commands/09_refactor/security_refactor.md` | `aidd-dev` | security-refactor | [9.3] |
| `commands/10_maintenance/debug.md` | `aidd-dev` | debug | [10.1] |
| `commands/10_maintenance/new_issue.md` | `aidd-vcs` | issue-create | [3.4] |
| `commands/10_maintenance/reflect_issue.md` | `aidd-dev` | reflect-issue | [10.2] |
| `commands/10_maintenance/reproduce.md` | `aidd-dev` | reproduce | [10.3] |

## Summary by Plugin

| Plugin | Command Count | Notes |
|---|---|---|
| `aidd-context` | 8 | brainstorm, challenge, create-user-stories, ticket-info, components-behavior, image-extract-details, plan, learn, mermaid (9 if counting both doc commands) |
| `aidd-dev` | 20 | All development lifecycle commands + onboard |
| `aidd-vcs` | 4 | commit, pull-request, release-tag, issue-create |
| `aidd-pm` | 0 | RC — no current commands map to PM skills directly |

Note: `commands/00_behavior/auto_accept.md` — behavior modifier, may be cross-plugin or handled differently.

## aidd-vcs Skill Bracket Numbering

The plan specifies `[3.X]` numbering for aidd-vcs skills. The `3.X` series could conflict with `aidd-context`'s plan phase (also mapped to `[3.X]` above). The plan's spec uses `[3.1]-[3.4]` for vcs. This spike uses the plan's numbering — the conflict with context's plan-phase commands should be resolved in Phase 1 planning (consider using `[8.X]` for deploy commands to match their current phase number).
