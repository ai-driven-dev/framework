#!/usr/bin/env bash
set -euo pipefail

# Run on aidd-agents as root from the trusted framework checkout or release bundle.
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
container=aidd-opencode-opencode-1
target=/opt/opencode/config/aidd-opencode-review
version="$(docker exec --user 10001:10001 "$container" opencode --version)"
[[ "$version" == 'opencode v2.2.5' ]] || { echo "Untested OpenCode version: $version" >&2; exit 1; }
binary="$(docker exec --user 10001:10001 "$container" readlink -f /usr/local/bin/opencode)"
[[ "$binary" == '/opt/aidd/toolchains/@opencode/cli-linux-x64@2.2.5/bin/opencode' ]] || { echo 'Unexpected OpenCode binary.' >&2; exit 1; }
install -d -m 0755 -o root -g root "$target/releases" "$target/bin"
install -d -m 0700 -o 10001 -g 10001 /opt/opencode/dev-state/aidd-opencode-review
binary_cache="$target/bin/opencode-2.2.5"
expected_hash="$(docker exec --user 10001:10001 "$container" sha256sum "$binary" | cut -d' ' -f1)"
if [[ ! -f "$binary_cache" ]]; then
  docker cp "$container:$binary" "$binary_cache.tmp.$$"
  chmod 0755 "$binary_cache.tmp.$$"
  chown root:root "$binary_cache.tmp.$$"
  mv "$binary_cache.tmp.$$" "$binary_cache"
fi
[[ "$(sha256sum "$binary_cache" | cut -d' ' -f1)" == "$expected_hash" ]] || { echo 'Pinned OpenCode binary does not match the tested version.' >&2; exit 1; }
release="$(mktemp -d "$target/releases/release.XXXXXXXX")"
install -d "$release/scripts/opencode-review" "$release/plugins/aidd-dev/skills" "$release/bin"
cp "$source_dir"/scripts/opencode-review/*.mjs "$source_dir"/scripts/opencode-review/{review.sh,snapshot.py,policy.json,prompt.txt} "$release/scripts/opencode-review/"
cp -R "$source_dir/plugins/aidd-dev/skills/05-review" "$release/plugins/aidd-dev/skills/"
ln "$binary_cache" "$release/bin/opencode"
chown -R root:root "$release"
find "$release" -type d -exec chmod 0755 {} +
find "$release" -type f -exec chmod a+r,go-w {} +
ln -s "releases/${release##*/}" "$target/current.new.$$"
mv -Tf "$target/current.new.$$" "$target/current"
if [[ ! -e /etc/aidd-opencode-review.env ]]; then
  printf 'OPENCODE_REVIEW_REPOSITORY=ai-driven-dev/framework\nOPENCODE_REVIEW_ENABLED_AT=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > /etc/aidd-opencode-review.env
  chmod 0644 /etc/aidd-opencode-review.env
fi
install -m 0644 "$source_dir/scripts/opencode-review/aidd-opencode-review.service" /etc/systemd/system/
install -m 0644 "$source_dir/scripts/opencode-review/aidd-opencode-review.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now aidd-opencode-review.timer
