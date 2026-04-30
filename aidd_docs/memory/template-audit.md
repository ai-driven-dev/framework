# Template Audit — Phase 0

## All Template Files (find aidd_docs/templates -type f)

39 files found across 5 categories.

## Migration Cross-Check

### VCS templates (7 files)

| File | Disposition | Target Plugin | Target Asset |
|---|---|---|---|
| `aidd_docs/templates/vcs/commit.md` | MIGRATED | aidd-vcs | `[3.1] commit/assets/commit-template.md` |
| `aidd_docs/templates/vcs/pull_request.md` | MIGRATED | aidd-vcs | `[3.2] pull-request/assets/pull_request.md` |
| `aidd_docs/templates/vcs/branch.md` | MIGRATED | aidd-vcs | `[3.2] pull-request/assets/branch.md` |
| `aidd_docs/templates/vcs/CONTRIBUTING.md` | MIGRATED | aidd-vcs | `[3.2] pull-request/assets/CONTRIBUTING.md` + `[3.4] issue-create/assets/CONTRIBUTING.md` |
| `aidd_docs/templates/vcs/README.md` | MIGRATED | aidd-vcs | `[3.2] pull-request/assets/README.md` |
| `aidd_docs/templates/vcs/release.md` | MIGRATED | aidd-vcs | `[3.3] release-tag/assets/release-template.md` |
| `aidd_docs/templates/vcs/issue.md` | MIGRATED | aidd-vcs | `[3.4] issue-create/assets/issue-template.md` |

Status: all 7 VCS templates migrated in pilot.

Note: Original templates remain in `aidd_docs/templates/vcs/` (additive-only in Phase 0). Deletion occurs in Phase 3 bulk migration.

### AIDD framework templates (14 files)

| File | Disposition | Target Plugin | Notes |
|---|---|---|---|
| `aidd_docs/templates/AGENTS.md` | KEEP | framework root | Installed by FrameworkLoaderAdapter TEMPLATE_REFS; not plugin content |
| `aidd_docs/templates/aidd/agent.md` | MIGRATE | aidd-dev | Template for agent generation skill |
| `aidd_docs/templates/aidd/agents_coordination.md` | MIGRATE | aidd-dev | Used by generate-agent command |
| `aidd_docs/templates/aidd/command.md` | MIGRATE | aidd-dev | Template for command generation |
| `aidd_docs/templates/aidd/master_plan.md` | MIGRATE | aidd-context | Used by plan command |
| `aidd_docs/templates/aidd/plan.md` | MIGRATE | aidd-context | Plan template |
| `aidd_docs/templates/aidd/prompt.md` | MIGRATE | aidd-dev | Prompt scaffold template |
| `aidd_docs/templates/aidd/rule.md` | MIGRATE | aidd-dev | Rule generation template |
| `aidd_docs/templates/aidd/skill.md` | MIGRATE | aidd-dev | Skill generation template |
| `aidd_docs/templates/aidd/task.md` | MIGRATE | aidd-context | Task template |
| `aidd_docs/templates/aidd/memory/*.md` (7 files) | MIGRATE | aidd-context | Memory templates used by init/onboard skills |
| `aidd_docs/templates/aidd/memory/internal/*.md` (6 files) | MIGRATE | aidd-context | Internal memory templates |

### Dev templates (6 files)

| File | Disposition | Target Plugin | Notes |
|---|---|---|---|
| `aidd_docs/templates/dev/adr.md` | MIGRATE | aidd-dev | Architecture Decision Record template |
| `aidd_docs/templates/dev/code_review.md` | MIGRATE | aidd-dev | Code review template |
| `aidd_docs/templates/dev/decision.md` | MIGRATE | aidd-dev | Decision template |
| `aidd_docs/templates/dev/review_code.md` | MIGRATE | aidd-dev | Review template (review-code skill asset) |
| `aidd_docs/templates/dev/review_functional.md` | MIGRATE | aidd-dev | Review template (review-functional skill asset) |
| `aidd_docs/templates/dev/tech_choice.md` | MIGRATE | aidd-dev | Technology choice template |

### PM templates (2 files)

| File | Disposition | Target Plugin | Notes |
|---|---|---|---|
| `aidd_docs/templates/pm/prd.md` | MIGRATE | aidd-pm | Product Requirements Document template |
| `aidd_docs/templates/pm/user_story.md` | MIGRATE | aidd-pm | User story template |

### Domain templates (1 file)

| File | Disposition | Notes |
|---|---|---|
| `aidd_docs/templates/domain/.gitkeep` | ORPHAN | Empty placeholder. No domain plugin planned. Keep as-is or remove in cleanup. |

## Orphans (no clear migration target)

- `aidd_docs/templates/domain/.gitkeep` — empty, no corresponding plugin. Disposition: DELETE in Phase 3 cleanup.

## Summary

| Category | Count | Status |
|---|---|---|
| vcs/ | 7 | All migrated in Phase 0 pilot |
| aidd/ | 14 | To migrate in Phase 2 (aidd-context) and Phase 3 (aidd-dev) |
| dev/ | 6 | To migrate in Phase 3 (aidd-dev) |
| pm/ | 2 | To migrate in Phase 11 (aidd-pm RC) |
| domain/ | 1 | Orphan — delete in Phase 3 cleanup |

Total templates to migrate across Phases 2-11: 22 files.
