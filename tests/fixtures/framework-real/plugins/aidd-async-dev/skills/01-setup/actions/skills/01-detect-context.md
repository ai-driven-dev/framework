# 01 -- Detect Context

Inspects the current repo and the active runtime to confirm preconditions.

## Inputs

- `cwd` (required) -- string, absolute path of the target repo

## Outputs

```json
{
  "repo_root": "/abs/path",
  "platform": "github",
  "remote_owner": "org",
  "remote_repo": "name",
  "default_branch": "main",
  "sdlc_capability_present": true,
  "monorepo": false,
  "codeowners_path": ".github/CODEOWNERS"
}
```

## Process

1. Resolve repo root via `git rev-parse --show-toplevel`.
2. Read `git remote get-url origin`, parse owner/repo, set `platform = "github"` (v1 supports GitHub only; abort if the remote points to GitLab).
3. Read `git symbolic-ref refs/remotes/origin/HEAD` to get the default branch.
4. Discover an SDLC orchestration capability by listing loaded skills and matching their description for keywords such as `SDLC orchestrator`, `plan, implement, test, review, commit, PR`, or `software development lifecycle`. Set `sdlc_capability_present` accordingly. Do not match by hardcoded skill name.
5. Detect monorepo by checking presence of `pnpm-workspace.yaml`, `package.json` with `workspaces`, `lerna.json`, or `Cargo.toml` with `[workspace]`.
6. Locate `CODEOWNERS` at `.github/CODEOWNERS`, `docs/CODEOWNERS`, or repo root; record path or `null`.
7. Emit the JSON above.

## Test

Run the action against a known GitHub repo with an SDLC-advertising skill loaded: `repo_root` exists, `remote_owner`/`remote_repo` match `gh repo view --json owner,name`, and `sdlc_capability_present` is `true`. Disable that skill and re-run: `sdlc_capability_present` is `false`.
