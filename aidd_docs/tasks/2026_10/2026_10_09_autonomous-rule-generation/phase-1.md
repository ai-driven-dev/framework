# Phase 1: remove CLI publication

Status: done

The executor restored cli/ to pinned base 12777d03 without touching personal changes. `git diff --exit-code 12777d03 -- cli/` exited 0. This removes the publication command, lifecycle wiring, formatter, tests and bundle budget increase from the initial candidate. No commit or push has occurred for the revision.
