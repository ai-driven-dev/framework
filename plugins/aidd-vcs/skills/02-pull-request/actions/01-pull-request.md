# 01 - Pull Request

Detect the base branch, fill the request template from the recent commits, validate with the user, and open a draft request via the configured VCS tool.

## Input

An optional base branch (auto-detected when omitted), and optional title or body overrides.

## Output

The draft request's URL and number, with its head and resolved base branch.

## Process

1. **Tool.** Use the VCS tool declared in project memory, otherwise map `git remote get-url origin` to the matching configured tool.
2. **Head.** Read the current branch with `git rev-parse --abbrev-ref HEAD`.
3. **Base.** Resolve the base in order: a provided base; otherwise the target the head branch's prefix maps to in the project's branch-naming convention (for example `feat/` → `next`, `hotfix/` → `main`); otherwise `git symbolic-ref refs/remotes/origin/HEAD`, then `main`, `master`, `develop`, `staging`. Surface the chosen base and the reason.
4. **Collect.** Summarize the commits and impacted files with `git log <base>..HEAD` and `git diff <base>...HEAD --stat`.
5. **Fill.** Load the request template, preferring the project's own (`aidd_docs/memory/vcs.md` or the repo's `PULL_REQUEST_TEMPLATE`) and falling back to the bundled one, plus any contributing rules, then write a concise title and a body following it from the change summary.
6. **Validate.** Show the title, body, and detected base. Apply any overrides, then wait for explicit approval.
7. **Open.** Create the request as a draft via the configured tool, passing the base, title, and body. Capture the URL and number.
8. **Label.** When the head prefix maps to a triage label that exists in the repo, apply it (for example `feat/` → `enhancement`). Skip silently otherwise. Labels triage only; they never change the base.
9. **Return.** Surface the URL, number, head, and base.

## Test

- The created request exists with `base` equal to the resolved base and the draft flag true.
- A head branch whose prefix is mapped resolves the base to that target, not the `origin/HEAD` default.
- When the head prefix maps to an existing triage label, the request carries it.
- The request is reachable at its URL with the head branch as its source.
