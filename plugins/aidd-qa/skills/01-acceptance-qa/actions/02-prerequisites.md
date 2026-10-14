# 02 - Prerequisites

## Input

The locked scope.

## Output

Verified browser runner, when needed.

## Process

Browser scenarios only: check `npx --offline --no -- @playwright/cli@0.1.17 --version`. Missing dependencies => report the error; install only with authorization, then recheck. Never add runner dependencies to application manifests.

## Test

The runner executes successfully.
