# 01 - Commit

Stage files, generate or accept a commit message, run the commit, optionally push, and return the resulting sha.

## Inputs

```yaml
mode: interactive | auto       # default: interactive
message: <imposed commit message>   # optional; when set, used as-is, no generation
push: true | false             # default: false
files: [<paths>]               # optional; restrict staging to these paths
```

When invoked via slash command, parse `$ARGUMENTS`:

- contains the word `push` → set `push: true`
- empty or anything else → leave `push: false`

## Outputs

```yaml
commit_sha: <full sha>
branch: <branch name>
pushed: true | false
```

## Process

1. **Branch resolution**. Pick first match:
   - branch already checked out -> use it
   - `mode = auto` -> generate a conventional name from the change
   - `mode = interactive` -> propose a name and wait for user approval
2. **Staging**. Pick first match:
   - `files` set -> `git add` exactly those paths
   - default -> use already-staged changes; do not add unstaged paths implicitly
3. **Message resolution**. Pick first match:
   - `message` provided -> use it verbatim, skip steps 4 and 5
   - `mode = auto` -> inspect diff and `git log -5 --pretty=%B`, generate a message per `assets/commit-template.md`, no approval
   - `mode = interactive` -> draft a message per the template, then proceed to steps 4 and 5
4. **Interactive split** (when `mode = interactive` and multiple concerns are present). For each split, show:
   - **Scope**: file list (proposal-only).
   - **Draft message**: conventional subject; body explains "why", never lists files.
   Wait for user approval.
5. **Interactive stage** (when `mode = interactive`). Run `git add -p` for each split.
6. **Commit**. Run `git commit` with the chosen message via heredoc.
7. **Hook recovery**. When a pre-commit hook fails, fix the underlying issue, re-stage, and create a new commit (do not amend). Loop until commit succeeds.
8. **Capture sha**. Read `git rev-parse HEAD`.
9. **Push**. When `push: true`, run `git push`. Use `--force-with-lease` only when explicitly required. Never `--force`.
10. **Return** the structured Outputs block. In interactive mode, also notify the user.

## Test

- **Sha match**: `git rev-parse HEAD` returns the new commit sha that matches the `commit_sha` field in Outputs.
- **Format**: `git log -1 --pretty=%s` matches the conventional commit regex `^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\([^)]+\))?: .+`.
- **Push**: when `push: true`, `git ls-remote origin <branch>` lists a sha equal to `commit_sha`.
