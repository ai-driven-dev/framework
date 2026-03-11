---
name: 'aidd:08:create_request'
description: 'Create PR (GitHub) or MR (GitLab) with filled template'
---

# Create Request Prompt

Fill a PR/MR template with recent changes in the current branch and create a request with it.

## Rules

- Use `git` and the VCS tool configured.
- Read instructions from the template and fill it.
- Use the `git log` commands to get the recent changes IF NOT PROVIDED.
- Do not commit anything, nor create new branches.
- Ask for user validation before creating the request.
- **CRITICAL: Detect the base branch correctly**
  - DO NOT assume it's `main` or `master`
  - Common base branches: `develop`, `main`, `master`, `staging`

## Resources

### Contributing

```markdown
@CONTRIBUTING.md
```

### Use this template

```markdown
@aidd_docs/templates/vcs/pull_request.md
```

## Steps

1. Get current branch name, project and repository.
2. If no custom branch found, generate one.
3. Detect the base branch.
4. Get current branch changes compared to the correct base branch.
5. Get template and fill it.
6. Create a beautiful request title.
7. **Ask user validation (including confirmation of base branch).**
8. Create the pull / merge request using the configured VCS tool.
9. Push it as a **draft**.
