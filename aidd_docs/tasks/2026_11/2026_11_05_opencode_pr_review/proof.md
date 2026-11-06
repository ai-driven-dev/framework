# OpenCode PR review verification

On 2026-11-06:

- `bash scripts/pr-review/test-review.sh` checked exact commits, review feedback,
  unchanged files, incomplete files, retries and duplicate publication using
  a simulated GitHub API and model.
- `bash scripts/pr-review/test-setup-project.sh` checked version selection,
  `latest`, plugin translation and credential redaction using a simulated CLI.
  A separate real `npx` run installed CLI 5.6.0 and translated `aidd-dev` and
  `aidd-vcs`: 16 skills, 2 agents, no links or token in the output.
- Both images built in OrbStack. `bash scripts/pr-review/test-runner.sh` checked
  Git and GitHub restrictions under the separate reviewer UID with a dummy
  token and simulated GitHub API.
- A real `openai/gpt-6.1-terra#medium` run in OrbStack identified a seeded
  authorization regression and listed `auth.js` as reviewed. The PR,
  GitHub responses and setup CLI were simulated; no real comment was posted.
- In the conversation image, OpenCode discovered the installed `05-review`
  skill and the translated agents. No GitHub token or AIDD cache was mounted.
- Under the automatic reviewer's policy, OpenCode called a synthetic skill and
  read its action; an external file was blocked. This used a simulated model.

Non-AIDD plugin sources are reported as unavailable. Plugin versions may differ
from the manifest because the default remote catalog is current. A publication
retry may run the model again; the bot checkpoint prevents duplicate successful
publications.

The new scheduled workflow is not active until it is on `main` and its dedicated
runner group and activation timestamp exist. The previous five-minute server
timer remains active; stop it during cutover to prevent duplicate reviews. The
new production schedule and real GitHub publication have not been tested.
