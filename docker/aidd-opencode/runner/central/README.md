# OpenCode review runner on Central

Prepare a **separate** rootless Docker daemon for this runner. Do not use the
existing CI users, their Docker sockets or the production daemon: another CI
job could access the reviewer's OAuth volume. Do not start the runner or stop
the old timer until the workflow is on `main` and the cutover is ready.

These units reuse the Central runner patterns from
[aidd-ops at f59307f](https://github.com/ai-driven-dev/aidd-ops/tree/f59307f08bfd0a6764ab5579b1d7eabe2fde0e5c/runner/central).
The templates were checked on 2026-11-06.
The commands below describe the host configuration; they do not register a
runner or copy credentials.

1. On Central, check SSH recovery, available capacity, and active CI and
   production services. Ensure the account `aidd-opencode-review`, its state
   directory `/var/lib/aidd-opencode-review`, the nft table
   `aidd_opencode_review`, and the units below do not already exist. Stop on
   any conflict. Check the pinned aidd-ops templates against the host's
   current Central runner policy before applying them.
2. Create the system account `aidd-opencode-review` with a private home at
   `/var/lib/aidd-opencode-review/home`, shell `/usr/sbin/nologin`, no sudo
   and no `docker` group. Give it a dedicated range of 65,536 subordinate
   UIDs and GIDs only after checking for overlap in **both** `/etc/subuid`
   and `/etc/subgid`. Create its Docker data directory at
   `/var/lib/aidd-opencode-review/docker`, owned by that account, mode 0700.
3. Render the pinned aidd-ops templates
   `nftables/aidd-workload-runner-egress.nft` and
   `systemd/aidd-workload-runner-egress.service` for the new account's actual
   UID, nft table `aidd_opencode_review`, and service
   `aidd-opencode-review-egress.service`. Remove the loopback exception:
   this runner needs none. Install only these new files at
   `/etc/nftables.d/aidd_opencode_review.nft` and
   `/etc/systemd/system/aidd-opencode-review-egress.service`; configure the
   service's `Before=` for `user@<UID>.service`. Verify the shared,
   root-owned `/usr/local/libexec/aidd-rootless-runtime/bin/busctl` shim
   matches the pinned `rootless-runtime/busctl`; do not overwrite it.
4. Install the three units from this directory: the slice under
   `/etc/systemd/system/`, `user-manager.conf` under
   `/etc/systemd/system/user@<UID>.service.d/`, and the Docker user unit under
   `/etc/systemd/user/`. Reload systemd and enable and start the egress unit
   **before** enabling linger or starting `user@<UID>`. Then enable and start
   `aidd-opencode-review-docker.service` with that user's systemd manager and
   `XDG_RUNTIME_DIR=/run/user/<UID>`.
5. Run **every** Docker command on Central as the dedicated account, with its
   private socket, including image builds, authentication, registration,
   starting the reviewer and rollback. For example:

   ```sh
   review_uid=$(id -u aidd-opencode-review)
   sudo -n -u aidd-opencode-review env \
     HOME=/var/lib/aidd-opencode-review/home XDG_RUNTIME_DIR="/run/user/$review_uid" \
     DOCKER_HOST="unix:///run/user/$review_uid/docker.sock" docker info
   ```

   Check that the security options include `rootless` before any further Docker
   operation. Do not use the host's default Docker socket. Supply credentials
   through a protected channel; never put them in host command arguments,
   shell history or logs.
6. Before registering the runner, build the trusted review image with that
   account and socket. Confirm Docker reports `rootless`,
   the user manager is in `aidd-central-ci-opencode.slice` under
   `aidd-central-ci.slice`, cgroup limits are
   effective, rootlesskit has `--disable-host-loopback`, and the container has
   no host Docker socket or host bind mounts. Run
   `scripts/__tests__/pr-review/test-runner.sh` against this daemon and image
   with the same container capabilities as the final deployment. From both
   container users, confirm public GitHub and npm access works, and that host
   loopback and a private-network test listener, reachable from the host, are
   unreachable. Do not activate the reviewer if any check fails.

Do not use `--network host` on Central, including for authentication: it
shares the host network and bypasses this rootless egress boundary. In
particular, do not run the host-network authentication command in the parent
README here.

Only after stopping the old timer **and** waiting for its service to finish,
migrate the existing OpenAI authentication from Agents over SSH into a new
rootless Docker volume. Do not use this OAuth account concurrently on Agents
and Central: refreshing a token can invalidate the other copy. The temporary
container has `--network none`, checks it has only loopback, and refuses to
overwrite an existing credential file. It receives no session database or tool
history.
Run this on the administrator's machine after building
`aidd-review-runner:local` in the dedicated rootless daemon:

```sh
set +x
set -o pipefail
ssh -o BatchMode=yes aidd-agents \
  "sudo -n jq -ce 'select(type == \"object\" and (.openai | type == \"object\")) | {openai: .openai}' /opt/opencode/state/auth.json" |
ssh -o BatchMode=yes aidd-central "$(cat <<'REMOTE'
  set -eu
  review_uid=$(id -u aidd-opencode-review)
  exec sudo -n -u aidd-opencode-review env \
    HOME=/var/lib/aidd-opencode-review/home XDG_RUNTIME_DIR="/run/user/$review_uid" \
    DOCKER_HOST="unix:///run/user/$review_uid/docker.sock" \
    docker run --rm -i --network none --cap-drop ALL --user reviewer \
      --mount type=volume,src=aidd-review-oauth,dst=/home/aidd/.local/share/opencode \
      --entrypoint sh aidd-review-runner:local -c '
        set -eu
        umask 077
        [ "$(ls /sys/class/net)" = lo ]
        dir=/home/aidd/.local/share/opencode
        tmp=$(mktemp "$dir/.auth.XXXXXXXX")
        trap "rm -f -- \$tmp" EXIT
        cat > "$tmp"
        jq -e . "$tmp" >/dev/null
        ln -T -- "$tmp" "$dir/auth.json"
        rm -f -- "$tmp"
        trap - EXIT
      '
REMOTE
)"
```

No credential is printed or placed in a command argument. If either SSH
command fails, keep the new path disabled. If OAuth has not been used on
Central, verify the Agents authentication remains intact before restarting
its timer. Otherwise OAuth rollback is not yet verified.

After the workflow reaches `main`, authorize only
`ai-driven-dev/framework/.github/workflows/opencode-review.yml@refs/heads/main`
in the dedicated GitHub runner group. Register the runner using the dedicated
account and socket. Keep `AIDD_REVIEW_ENABLED_AT` unset and the old timer
running while testing with synthetic credentials only, without publishing.
At cutover, stop the old timer and wait for its service to finish. Record the
UTC cutoff, transfer the isolated OAuth file as above, and run a model smoke
without publishing. Then set `AIDD_REVIEW_ENABLED_AT` to the cutoff and
reconcile reviews submitted since the old service's last scan: the old and new
checkpoints are different. Verify a new submitted review is published once.
If cutover fails, disable the new path first. Do not blindly restart the old
timer after Central has used OAuth: verify or restore its authentication first,
as token refresh may have invalidated it. OAuth rollback is not yet verified.

## Rollback

Using the dedicated account and socket, stop and remove only the new review
container, if created, and stop and disable its rootless Docker user unit.
Require `loginctl disable-linger` to succeed and confirm linger is disabled;
stop `user@<UID>` and confirm it is inactive. Confirm no process runs under
the dedicated UID and its cgroup is empty (`populated 0`) or no longer exists.
If any step fails or any of those observations is uncertain, keep the nft
filter, account, configuration and data in place; do not continue rollback.

Only after those checks, require the egress service to stop and disable:

```sh
sudo systemctl disable --now aidd-opencode-review-egress.service
```

Independently require a successful nft table listing that confirms
`inet aidd_opencode_review` is absent. If either check fails or its result
cannot be read, retain the UID,
subordinate ID ranges and configuration files; an orphaned table must not
filter a future account. Once absence is confirmed, remove the three installed
units, its egress unit and nft file, and reload systemd. Preserve the OAuth
volume and state directory until their contents are no longer needed. Remove
the dedicated account and its subordinate ID ranges only after confirming no
remaining process or data belongs to it. Verify the existing CI, production
services and SSH still work. Do not alter their nft tables, users, Docker
daemons or runner groups.
