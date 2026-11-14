# PR review runner

**TL;DR:** run this image on a dedicated server runner restricted to the
trusted review workflow. It installs the project's AIDD version with `npx`,
reads the submitted Git diff and PR discussion, then publishes through the
workflow. Without a manifest it uses `latest` and reports the missing plugin
inventory.

Only plugins from the trusted AIDD catalog are installed. Other recorded
sources are reported as unavailable, and installed plugin versions may differ
from the manifest because the remote catalog is current.

Set these repository variables before enabling the workflows:

- `OPENCODE_REVIEWER_ID`: numeric GitHub user ID allowed to submit reviews and
  invoke `/opencode`. A missing or invalid ID authorizes nobody. Look it up
  with `gh api users/USERNAME --jq .id`.
- `AIDD_REVIEW_ENABLED_AT`: start timestamp in UTC, `YYYY-MM-DDTHH:MM:SSZ`.
- `OPENCODE_BASE_BRANCH`: optional base branch for issue-created PRs; defaults
  to the repository's default branch.
- `OPENCODE_REVIEW_MODEL` and `OPENCODE_AGENT_MODEL`: optional OpenCode model
  identifiers. Defaults are `openai/gpt-6.1-terra#medium` and
  `opencode-go/beam-free`, respectively.

Configure the `AIDD_BOT_APP_ID` and `AIDD_BOT_PRIVATE_KEY` secrets for the
GitHub App. The `/opencode` workflow also requires `OPENCODE_API_KEY` and a
model available through that credential.

```sh
docker build -f docker/aidd-opencode/runner/Dockerfile -t aidd-review-runner:local .
docker volume create aidd-review-oauth
```

Authenticate the chosen provider in a temporary container using this volume.
Use a provider-supported device code or a protected callback tunnel if the
browser is on another machine. Do not expose the host network to the runner.
OpenCode's [provider documentation](https://dev.opencode.ai/v2/docs/cli/providers/)
describes the available login methods (read 2026-11-07):

```sh
: "${OPENCODE_PROVIDER:?Set OPENCODE_PROVIDER to your OpenCode provider}"
docker run --rm -it --user reviewer -e HOME=/home/aidd \
  -v aidd-review-oauth:/home/aidd/.local/share/opencode \
  --entrypoint opencode aidd-review-runner:local --standalone auth login "$OPENCODE_PROVIDER"
```

This deployment requires a GitHub organization: its runner group must be
limited to this repository and its review workflow on the default branch.
Personal-account repositories need a different isolation design; using an
unrestricted self-hosted runner on a public repository is unsafe. The
[GitHub runner group documentation](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/manage-access)
describes this restriction (read 2026-11-07).

Create an `aidd-opencode-review` group with those restrictions. Use the
organization name in `AIDD_RUNNER_ORG`. Register the container without a
Docker socket or host data:

```sh
docker run -d --name aidd-review --restart unless-stopped \
  --cap-drop ALL --cap-add SETUID --cap-add SETGID --cap-add CHOWN \
  --cap-add AUDIT_WRITE --cap-add DAC_OVERRIDE --cap-add KILL \
  -v aidd-review-oauth:/home/aidd/.local/share/opencode \
  --entrypoint /bin/sh aidd-review-runner:local -c \
    'while [ ! -f .configured ]; do sleep 1; done; exec /opt/aidd/runner'
: "${AIDD_RUNNER_ORG:?Set AIDD_RUNNER_ORG to your GitHub organization}"
gh api --method POST "orgs/$AIDD_RUNNER_ORG/actions/runners/registration-token" --jq .token |
  docker exec -i --env AIDD_RUNNER_ORG="$AIDD_RUNNER_ORG" aidd-review sh -c '
    set -eu; read -r token; umask 077
    ./config.sh --unattended --url "https://github.com/$AIDD_RUNNER_ORG" \
      --token "$token" --name aidd-review --runnergroup aidd-opencode-review
    touch .configured
  '
```

Rebuild and replace the image when its trusted runtime files change. The
reviewer has a repository-scoped read token; only the workflow receives the
separate write token. The container and separate user reduce exposure but do
not eliminate prompt-injection or container-escape risks.
