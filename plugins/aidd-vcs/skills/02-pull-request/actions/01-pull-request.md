# 01 - Pull Request

Detect the base branch, fill the request template with recent commits, validate with the user, and open a draft request via the configured VCS tool.

## Inputs

```yaml
base_branch: <branch name>     # optional; auto-detect from repo state when omitted
template_overrides:            # optional; override specific template sections
  title: <imposed title>
  body: <imposed body>
```

## Outputs

```yaml
pr_url: <url>
pr_number: <int>
branch: <head branch>
base: <base branch>
is_draft: true
```

## Process

1. **Tool resolution**. Pick first match:
   - VCS tool declared in project memory -> use it
   - default -> map `git remote get-url origin` to the matching configured tool
2. **Branch identity**. Read current head via `git rev-parse --abbrev-ref HEAD`.
3. **Base resolution**. Pick first match:
   - `base_branch` provided -> use it
   - the branch-naming convention in project memory maps the head branch's prefix to a PR target (e.g. `feat/` -> `next`, `hotfix/` -> `main`) -> use that target
   - default -> inspect `git symbolic-ref refs/remotes/origin/HEAD`, then candidate list `main`, `master`, `develop`, `staging`
   - surface the chosen value and the reason during validation
4. **Collect changes**. Run `git log <base>..HEAD --pretty=fuller` and `git diff <base>...HEAD --stat` to summarize commits and impacted files.
5. **Read template**. Load `assets/pull_request.md` and any contributing rules from `assets/CONTRIBUTING.md`.
6. **Fill template**. Generate a concise title and a body that follows the template structure, using the change summary from step 4.
7. **Validate with user**. Show title, body, and detected base branch. Apply `template_overrides` when provided. Wait for explicit user approval.
8. **Open draft**. Invoke the configured VCS tool to create the request as a draft, passing base, title, and body. Capture the returned URL and number.
9. **Set triage label**. When the branch-naming convention maps the head branch's prefix to a triage label (e.g. `feat/` -> `enhancement`, `fix/` -> `bug`) and that label exists in the repo, apply it. Skip silently when there is no mapping or no matching label. Labels triage only; they never change the base resolved in step 3.
10. **Return** the structured Outputs block.

## Test

- **Tool view**: querying the configured VCS tool for the created request returns a record where `url` equals `pr_url`, `base` equals the resolved base branch, and the draft flag is true.
- **Prefix routing**: a head branch whose prefix is mapped in project memory resolves `base` to that prefix's target (e.g. `feat/*` -> `next`, `hotfix/*` -> `main`), not the `origin/HEAD` default.
- **Triage label**: when the head prefix maps to a triage label that exists in the repo, the created request carries that label.
- **Reachable**: the created request is reachable at `pr_url` and lists the head branch as the current branch.
