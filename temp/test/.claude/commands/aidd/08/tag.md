---
name: 'aidd:08:tag'
description: 'Create and push git tag with semantic versioning'
---

# Tag Prompt

## Goal

Generate semantic version tag and push to remote repository.

## Rules

- Deduct versioning (major.minor.patch)
- Follow semver standards
- Include release notes
- Title: `v[VERSION] - [Brief Description]`

## Ressources

### Template for Release Notes

Mandatory template to use to release, present it to user:

```markdown
@aidd_docs/templates/vcs/release.md
```

## Process steps

1. Get current project version from version manager package
2. Check existing tags and get version !`VERSION=$(git tag --sort=-version:refname | head -1)` (if none exists, use "1.0.0")
3. Gather changes: `git log --oneline "$VERSION..HEAD"`
4. Generate comprehensive release notes with rules and template
5. Calculate new version number (if not specified by user):
   1. If "BREAKING CHANGE" in notes, increment major
   2. If "feat" in notes, increment minor
   3. If "fix" in notes, increment patch
6. **Provide full template, ask for user approval**
7. Only add to commit files that have been modified for the version bump
8. Create annotated tag,
9. Create issue (with labels and type) based on
10. Create `chore: bump version`'s commit only for the version bump
11. Push it & push tags
12. Display release URL
