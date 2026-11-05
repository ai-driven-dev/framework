#!/usr/bin/env bash
set -euo pipefail
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
umask 077
[[ $# == 0 ]] || exit 2

root=/var/lib/aidd-review
# Read runner-controlled paths as the runner, never with root filesystem access.
work=$(runuser -u runner -- env -i PATH=/usr/bin:/bin cat "$root/inbox/current")
[[ $work =~ ^/tmp/aidd-review\.[[:alnum:]]{8}$ || $work =~ ^/home/runner/actions-runner/_work/_temp/aidd-review\.[[:alnum:]]{8}$ ]] || { echo 'Invalid review request' >&2; exit 1; }
exec 9>"$root/jobs/lock"
flock -n 9 || { echo 'Another review is running' >&2; exit 1; }
job=$(mktemp -d "$root/jobs/job.XXXXXXXX")
trap 'rm -rf -- "$job"' EXIT
chmod 0755 "$job"
install -d -o runner -g runner -m 0700 "$job/incoming"
runuser -u runner -- env -i PATH=/usr/bin:/bin cp -RP -- "$work/input" "$job/incoming/workspace"
runuser -u runner -- env -i PATH=/usr/bin:/bin cp -P -- "$work/manifest.json" "$job/incoming/manifest.json"
runuser -u runner -- env -i PATH=/usr/bin:/bin chmod -R u+rwX,go+rX "$job/incoming"
chown -hR root:aidd-review "$job/incoming"
[[ -d $job/incoming/workspace && ! -L $job/incoming/workspace && -f $job/incoming/manifest.json && ! -L $job/incoming/manifest.json ]] || { echo 'Invalid review snapshot' >&2; exit 1; }
if [[ -n $(find "$job/incoming/workspace" ! -type f ! -type d -print -quit) ]]; then
  echo 'Review snapshot contains a link or special file' >&2
  exit 1
fi
chown root:aidd-review "$job"
chmod 0750 "$job"
chmod -R a-w,g+rX "$job/incoming/workspace"
chmod 0550 "$job/incoming"
chmod 0440 "$job/incoming/manifest.json"
# Every source and chunk must be immutable to the reviewer, not just the parent.
if [[ -n $(find "$job/incoming/workspace" \( ! -user root -o -perm /022 \) -print -quit) ]]; then
  echo 'Review snapshot contains writable or non-root-owned files' >&2
  exit 1
fi
install -d -o reviewer -g reviewer -m 0700 "$job/out"
timeout --kill-after=10s 15m runuser -u reviewer -- env -i HOME=/home/aidd PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 \
  /opt/aidd/model.sh "$job/incoming/workspace" "$job/incoming/manifest.json" "$job/out/result.json" 9>&-
runuser -u reviewer -- test -f "$job/out/result.json"
runuser -u reviewer -- test ! -L "$job/out/result.json"
runuser -u reviewer -- cat "$job/out/result.json" > "$root/result.json.tmp"
chown root:aidd-review "$root/result.json.tmp"
chmod 0640 "$root/result.json.tmp"
mv -f -- "$root/result.json.tmp" "$root/result.json"
