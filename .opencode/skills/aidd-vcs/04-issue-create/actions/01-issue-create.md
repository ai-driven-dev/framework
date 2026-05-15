# 01 - Issue Create

Detect the ticketing tool, gather a thorough problem description, fill the issue template, validate with the user, then create the issue.

## Inputs

```yaml
problem_description: <free text>   # required
repo_url: <url>                    # optional; default: derived from `git remote get-url origin`
labels: [<label>]                  # optional
type: bug | feature | task | docs  # optional; default: inferred from description
projects: [<project>]              # optional
milestone: <milestone>             # optional
```

## Outputs

```yaml
tool: <configured ticketing tool>
issue_url: <url>
issue_number: <int>
title: <issue title>
labels: [<label>]
type: <type>
```

## Process

1. **Tool resolution**. Pick first match:
   - ticketing tool declared in project memory -> use it
   - default -> map `git remote get-url origin` to the matching configured tool
2. **Read context**. Load `assets/CONTRIBUTING.md` and `assets/issue-template.md`. Skim existing open issues via the configured tool to avoid duplicates.
3. **Gather details**. Combine `problem_description` with technical context (stack, repro steps, environment). Ask the user follow-up questions when required fields are missing.
4. **Web search**. Look up official documentation that backs the issue when applicable (e.g. linked errors, framework changelog).
5. **Fill template**. Generate a concise title and body that match the template structure. Pick a `type` (bug, feature, task, docs) when not provided.
6. **Validate**. Show title, body, labels, type, projects, and milestone. Wait for explicit user approval.
7. **Create**. Invoke the configured ticketing tool to open the issue, passing title, body, labels, projects, and milestone.
8. **Capture** the returned URL and number. Return the structured Outputs block.

## Test

- **Tool view**: querying the configured ticketing tool for the created issue returns a record where `url` equals `issue_url`, `title` equals the validated title, and `labels` matches the validated labels.
- **Reachable**: the created issue is reachable at `issue_url` in the tracker UI.
