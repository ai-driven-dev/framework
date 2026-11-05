# AIDD review runner

This image runs GitHub's Linux runner as `runner` and the OpenCode reviewer as a
separate `reviewer` user. Build the base image first, then build this image from
the repository root:

```sh
docker build -t aidd-opencode:local docker/aidd-opencode
docker build -f docker/aidd-opencode/runner/Dockerfile -t aidd-review-runner:local .
```

The build embeds `scripts/pr-review/model.sh`. `/opt/aidd/run-review WORKSPACE
MANIFEST OUTPUT` refuses to run if the embedded runtime differs from the trusted
checkout. It stages the input as the runner, freezes a root-owned snapshot, and
executes the model as the reviewer. GitHub credentials are not passed to the
reviewer.

Use a dedicated volume owned by UID 1002 for
`/home/aidd/.local/share/opencode`; authenticate that account separately.
Use a separate persistent volume owned by UID 1001 for
`/home/runner/.local/state/aidd-pr-review` so a publication retry can reuse its
completed review without running the model again.
Do not mount the Docker socket, the shared OpenCode database, or other host data.
For the UID change, a local container can use `--cap-drop ALL` and explicitly
add `SETUID`, `SETGID`, `CHOWN`, `AUDIT_WRITE`, `DAC_OVERRIDE`, and `KILL`.
`no-new-privileges` prevents sudo from changing UID and is incompatible.

## Installation

1. Once the workflow is on `main`, create the `aidd-opencode-review` runner
   group, allowing public repositories but limited to this repository and
   `ai-driven-dev/framework/.github/workflows/opencode-review.yml@refs/heads/main`.
2. Create empty volumes and start the container waiting for registration:

   ```sh
   docker volume create aidd-review-oauth
   docker volume create aidd-review-state
   docker run -d --name aidd-review --restart unless-stopped \
     --cap-drop ALL --cap-add SETUID --cap-add SETGID --cap-add CHOWN \
     --cap-add AUDIT_WRITE --cap-add DAC_OVERRIDE --cap-add KILL \
     -v aidd-review-oauth:/home/aidd/.local/share/opencode \
     -v aidd-review-state:/home/runner/.local/state/aidd-pr-review \
     --entrypoint /bin/sh aidd-review-runner:local -c \
       'while [ ! -f .configured ]; do sleep 1; done; exec /opt/aidd/runner'
   ```

3. Authenticate the existing Codex account as `reviewer`:

   ```sh
   docker exec -it --user reviewer -e HOME=/home/aidd aidd-review \
     opencode --standalone auth login openai
   ```

   Browser OAuth needs a private route from the browser to the container's
   loopback callback. Setting up that route is a manual step and is not covered
   by this guide.
4. Set `AIDD_REVIEW_ENABLED_AT` to the intended UTC activation time in
   `YYYY-MM-DDTHH:MM:SSZ` format. Stop the old timer and wait for any active
   review before registering the runner. The cutoff determines which submissions
   are picked up; old local fingerprints are not imported.
5. With `gh` authenticated as an organization administrator, register the same
   container using a short-lived token. It is passed over stdin and is not stored
   in the container's environment:

   ```sh
   gh api --method POST orgs/ai-driven-dev/actions/runners/registration-token --jq .token |
     docker exec -i aidd-review sh -c '
       set -eu; read -r token; umask 077
       ./config.sh --unattended --url https://github.com/ai-driven-dev \
         --token "$token" --name aidd-review --runnergroup aidd-opencode-review
       touch .configured
     '
   ```

   The container starts the runner once registration succeeds. Stop it
   gracefully before restarting so GitHub can close its session. Registration
   is in the container's writable layer: replacing it requires a new registration.
   Rebuild and replace the image whenever an embedded runtime file changes.

A separate UID and container reduce access; they do not prove that prompt
injection cannot expose the model credential available to the reviewer. A
persistent runner can also retain changes between jobs.
