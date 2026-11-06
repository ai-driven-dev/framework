# PR review runner

**TL;DR:** run this image on a dedicated server runner restricted to the
trusted review workflow. It installs the project's AIDD version with `npx`,
reads the submitted Git diff and PR discussion, then publishes through the
workflow. Without a manifest it uses `latest` and reports the missing plugin
inventory.

On Central, follow the [isolated rootless setup](central/README.md); do not use
the host's default Docker daemon.

```sh
docker build -f docker/aidd-opencode/runner/Dockerfile -t aidd-review-runner:local .
docker volume create aidd-review-oauth
```

On the server, authenticate the reviewer in a temporary container using this
volume. For browser-based OAuth, forward the local callback port to the server
before running the login:

```sh
docker run --rm -it --network host --user reviewer -e HOME=/home/aidd \
  -v aidd-review-oauth:/home/aidd/.local/share/opencode \
  --entrypoint opencode aidd-review-runner:local --standalone auth login openai
```

After the workflow is on `main`, create an `aidd-opencode-review` runner
group limited to this repository and its review workflow on `main`. Set
`AIDD_REVIEW_ENABLED_AT` to a UTC timestamp, stop the old timer, then register
the container in that group. Start it without a Docker socket or host data:

```sh
docker run -d --name aidd-review --restart unless-stopped \
  --cap-drop ALL --cap-add SETUID --cap-add SETGID --cap-add CHOWN \
  --cap-add AUDIT_WRITE --cap-add DAC_OVERRIDE --cap-add KILL \
  -v aidd-review-oauth:/home/aidd/.local/share/opencode \
  --entrypoint /bin/sh aidd-review-runner:local -c \
    'while [ ! -f .configured ]; do sleep 1; done; exec /opt/aidd/runner'
gh api --method POST orgs/ai-driven-dev/actions/runners/registration-token --jq .token |
  docker exec -i aidd-review sh -c '
    set -eu; read -r token; umask 077
    ./config.sh --unattended --url https://github.com/ai-driven-dev \
      --token "$token" --name aidd-review --runnergroup aidd-opencode-review
    touch .configured
  '
```

Rebuild and replace the image when its trusted runtime files change. The
reviewer has a repository-scoped read token; only the workflow receives the
separate write token. The container and separate user reduce exposure but do
not eliminate prompt-injection or container-escape risks.
