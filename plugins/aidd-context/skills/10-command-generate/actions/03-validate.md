# 03 - Validate

Check each written command file.

## Input

The list of files written (from 02).

## Output

A short pass or fail line per command file.

## Process

1. **Exists.** Confirm each file is on disk at its expected path, at its chosen location.
2. **Shape.** Confirm the frontmatter and body match the tool. If the command takes input, the body uses `$ARGUMENTS`.
3. **Concise.** Confirm a single objective and fewer than ten steps.

## Test

- Every command file exists and sits at its confirmed location. It uses `$ARGUMENTS` when it takes input.
