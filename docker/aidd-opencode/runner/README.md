# AIDD review runner

This image runs GitHub's Linux runner as `runner` and the OpenCode reviewer as a
separate `reviewer` user. Build the base image first, then build this image from
the repository root:

```sh
docker build -t aidd-opencode:local docker/aidd-opencode
docker build -f docker/aidd-opencode/runner/Dockerfile -t aidd-review-runner:local .
```

The build embeds `scripts/pr-review/model.sh`. `/opt/aidd/run-review WORKSPACE
MANIFEST OUTPUT` refuses to run if the embedded runtime differs from the trusted checkout.
It stages the input as the runner, freezes a root-owned snapshot, and executes
the model as the reviewer. GitHub credentials are not passed to the reviewer.

Use a dedicated volume owned by UID 1002 for
`/home/aidd/.local/share/opencode`; authenticate that account separately.
Use a separate persistent volume owned by UID 1001 for
`/home/runner/.local/state/aidd-pr-review` so a publication retry can reuse its
completed review without running the model again.
Do not mount the Docker socket, the shared OpenCode database, or other host data.
For the UID change, a local container can use `--cap-drop ALL` and explicitly
add `SETUID`, `SETGID`, `CHOWN`, `AUDIT_WRITE`, `DAC_OVERRIDE`, and `KILL`.
`no-new-privileges` prevents sudo from changing UID and is incompatible.

Runner registration and lifecycle are not part of the image. Restrict any
production runner group to the trusted default-branch workflow. A separate UID
and container reduce access; they do not prove that prompt injection cannot
expose the model credential available to the reviewer. A persistent runner can
also retain changes between jobs.
