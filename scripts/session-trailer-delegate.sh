#!/bin/sh
# A file, not a lefthook run: its quotes would break Windows' hand-built sh -c line (#948).
delegate="$(git rev-parse --git-common-dir)/hooks/$1"
shift
if [ -f "$delegate" ]; then sh "$delegate" "$@"; fi
