#!/bin/sh
set -eu

# Protect runner registration credentials before starting GitHub Actions.
umask 077
cd /home/runner/actions-runner
if [ -f .credentials ]; then
  chmod 600 .runner .credentials .credentials_rsaparams
fi
exec /home/runner/actions-runner/run.sh "$@"
