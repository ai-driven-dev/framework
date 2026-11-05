#!/bin/sh
set -eu
umask 077
exec /home/runner/actions-runner/run.sh "$@"
