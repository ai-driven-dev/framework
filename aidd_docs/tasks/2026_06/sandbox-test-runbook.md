# Sandbox test runbook - rolling weekly releases

Validates the `main`/`next` release model end to end before it touches the real
repo. Two layers: a local git simulation (offline, deterministic, no GitHub) for
the back-merge logic, and a GitHub sandbox repo for the parts that need real
Actions, rulesets, the App, and release-please.

> ATTENTION
> - Never run the GitHub scenarios against the production repo first. The
>   auto-merge step merges the Release PR automatically; a wrong setup ships.
> - Use a throwaway sandbox repo and delete it at the end.
> - The App token has write + bypass. Treat its private key as a secret.

## Real-repo rollout order (critical)

The auto-merge step in `ci.yml` goes live the instant that file lands on `main`,
independent of everything else. Today release PRs are human-merged, which
effectively batches many pushes into one shipped release. The moment the step is
active it flips to release-on-every-push-to-main. If features still land directly
on `main` (the current habit) and `next` does not yet steer them, that means a
release per feature push and the leak window stays wide. Also `back-merge.yml`
triggers on `release: published` and checks out `next`; if a release fires before
`next` exists, it errors.

So land the pieces in this order on the real repo, not all at once:

1. Create `next` (`git branch next main && git push -u origin next`).
2. Apply `next.json` ruleset and confirm `main` blocks direct pushes (features
   must target `next`). Verify direct-to-main is actually rejected.
3. Only then merge the PR that adds the `ci.yml` auto-merge step and
   `back-merge.yml`.
4. Remove `version` from `marketplace.json` any time (independent, schema-safe).

Verified: at the pinned action SHA, `prs_created` and `pr` (with `.number`) are
real `release-please-action` v5 outputs, so the step's guard and PR lookup are
correct by name. Whether the App merges immediately is the runtime unknown - see
Scenario 2 WATCH.

## Layer 1 - Local git simulation (run now, offline)

Covers the `back-merge.yml` git logic: clean back-merge, conflict -> abort,
hotfix back-merge. No GitHub, no Actions. Runs in an isolated temp dir.

```bash
set -euo pipefail
SB=$(mktemp -d /tmp/aidd-sandbox.XXXXXX); trap 'rm -rf "$SB"' EXIT
cd "$SB"; git init -q --bare origin.git; git clone -q origin.git work; cd work
git config user.email t@t; git config user.name tester; git config commit.gpgsign false

printf '# Changelog\n\nseed\n' > CHANGELOG.md; echo "code v0" > app.txt
git add -A; git commit -qm "chore: seed"; git branch -M main; git push -q origin main
git checkout -q -b next; git push -q origin next

# A) happy: feat -> next, promote next -> main, release commit on main, back-merge
git checkout -q next; echo "feature" >> app.txt; git commit -qam "feat: add x"; git push -q origin next
git checkout -q main; git merge -q --no-edit next; git push -q origin main
printf '# Changelog\n\n## 1.1.0\n- feat: add x\n\nseed\n' > CHANGELOG.md
git commit -qam "chore(main): release 1.1.0"; git push -q origin main
git checkout -q next; git fetch -q origin main
git merge --no-edit origin/main >/dev/null 2>&1 && { git push -q origin next; echo "A clean back-merge OK"; } || { echo "A unexpected conflict"; exit 1; }

# B) conflict: same CHANGELOG line diverges -> merge must abort cleanly
git checkout -q next; printf '# Changelog\n\nNEXT-SIDE EDIT\n' > CHANGELOG.md
git commit -qam "docs: tweak changelog"; git push -q origin next
git checkout -q main; printf '# Changelog\n\nMAIN RELEASE EDIT\n' > CHANGELOG.md
git commit -qam "chore(main): release 1.2.0"; git push -q origin main
git checkout -q next; git fetch -q origin main
git merge --no-edit origin/main >/dev/null 2>&1 && { echo "B should have conflicted"; exit 1; } || { git merge --abort; echo "B conflict -> abort OK (PR path)"; }
```

Expected: `A clean back-merge OK`, `A` next has the release commit, `B conflict
-> abort OK`. A failed assertion means the workflow's git logic is wrong.

## Layer 2 - GitHub sandbox (needs a real repo)

These cannot be tested locally: release-please opening/auto-merging the Release
PR, ruleset enforcement, App bypass, workflow triggering on `push`/`release`.

### Setup

1. Create a throwaway repo, e.g. `ai-driven-dev/release-sandbox` (private).
2. Copy in: `.github/workflows/ci.yml`, `.github/workflows/back-merge.yml`,
   `release-please-config.json`, `.release-please-manifest.json`,
   `.claude-plugin/`, `plugins/` (a trimmed set is fine), and
   `.github/rulesets/{main,next}.json`.
3. Install the AIDD bot App (or a dedicated test App) on the sandbox; set repo
   secrets `AIDD_BOT_APP_ID`, `AIDD_BOT_PRIVATE_KEY`.
4. Push `main`, then create `next`: `git branch next main && git push -u origin next`.
5. Apply the rulesets (GitHub does not auto-sync `.github/rulesets/*.json`):
   ```bash
   gh api -X POST repos/ai-driven-dev/release-sandbox/rulesets --input .github/rulesets/main.json
   gh api -X POST repos/ai-driven-dev/release-sandbox/rulesets --input .github/rulesets/next.json
   ```
   Fix the `bypass_actors[].actor_id` to the sandbox App/team ids first.
6. Leave repo "Allow auto-merge" OFF for the primary test (immediate merge). Turn
   it ON only when testing the `--auto` fallback.

### Scenario 1 - setup integrity

- `git ls-remote --heads origin next` returns a ref.
- `gh api repos/<sb>/rulesets` lists `main protection` and `next protection` active.
- The App appears in each ruleset's bypass list.

### Scenario 2 - happy weekly release

1. `feat/x` off `next` -> PR to `next` -> merge. Expect: checks run, merge allowed
   with 0 required reviews on `next`.
2. Promotion PR `next` -> `main` -> merge.
3. Observe in Actions/PRs/Releases, and ASSERT each (a silent no-op must fail
   the test loudly, not look fine):
   - release-please opens a `chore(main): release ...` PR on `main`.
   - the "Auto-merge the Release PR" step runs AND the Release PR shows
     `MERGED` by the App within one CI run. Assert it, e.g.
     `gh pr list --state merged --search "release in:title" --json mergedBy,title`
     shows the App as `mergedBy`. If the step's `if` was silently false (wrong
     output name) the PR stays open and this assertion fails - that is the point.
   - tags created, GitHub Releases created, `build-*` jobs attach the bundles.
   - `back-merge.yml` fires on `release: published` and `next` advances to `main`.

RESOLVED in a sandbox probe (ai-driven-dev/aidd-release-sandbox):
- A plain `gh pr merge --squash` is REFUSED by the branch policy ("base branch
  policy prohibits the merge") even for a bypass actor with unmet review +
  pending required checks. `gh pr merge --squash --admin` performs the override
  merge that the ruleset bypass permits, and succeeds. The ci.yml step therefore
  uses `--admin`. (`--auto` is not viable here: a bot can never satisfy the
  required review, so it would wait forever, and the repo had `allow_auto_merge`
  off.)

STILL WATCH:
- Confirm the App-token `--admin` merge works for the App specifically (the probe
  used an admin user; the App is a bypass actor in the prod ruleset, which should
  grant the same override - confirm on the first real run).
- Confirm the App-token merge RE-FIRES the downstream jobs (build + back-merge). A
  `GITHUB_TOKEN` merge would not; that is why the step uses the App token.

### Scenario 3 - hotfix out of cycle

1. `hotfix/y` off `main` -> PR to `main` -> merge.
2. Expect: release-please cuts a dedicated patch release; back-merge runs.

### Scenario 4 - back-merge conflict

1. On `next`, commit a change to `CHANGELOG.md` top lines; push.
2. Trigger a release on `main` that edits the same region.
3. Expect: `back-merge.yml` aborts the merge and opens a
   `chore: back-merge main into next (conflicts)` PR instead of pushing.

### Scenario 5 - new-user leak window (manual observation)

- During Scenario 2, between the promotion merge and the Release PR auto-merge,
  `main` HEAD briefly holds unbumped code. Confirm the window is only one CI run
  (auto-merge is near-immediate), not human time. If the merge is not immediate,
  this is the leak the model exists to avoid - fix per Scenario 2 WATCH.

### Teardown

```bash
gh repo delete ai-driven-dev/release-sandbox --yes
```

## What each layer proves

| Concern | Layer 1 (local) | Layer 2 (GitHub) |
| --- | --- | --- |
| back-merge clean / conflict / hotfix git logic | yes | yes |
| release-please opens Release PR | no | yes |
| auto-merge step actually merges | no | yes |
| immediate vs `--auto` merge for the bypass App | no | yes (the key unknown) |
| App token re-fires downstream workflows | no | yes |
| ruleset enforcement + App bypass on `next` | no | yes |
| marketplace.json still schema-valid after version removal | already checked (`check-jsonschema`) | n/a |
