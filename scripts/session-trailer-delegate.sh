#!/bin/sh
delegate="$(git rev-parse --git-common-dir)/hooks/$1"
shift
if [ -f "$delegate" ]; then sh "$delegate" "$@"; fi
