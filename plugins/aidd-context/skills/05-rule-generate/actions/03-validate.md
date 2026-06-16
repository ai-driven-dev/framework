# 03 - Validate

Check each written rule file against the contract.

## Input

The list of files written (from 02).

## Output

A short pass or fail line per rule file.

## Process

1. **Exists.** Confirm each file is on disk at its expected path.
2. **Frontmatter.** Confirm each carries its tool's scope frontmatter matching the rule's reach, per `@../references/tool-paths.md`. An all-files rule may carry no scope field.
3. **Concise.** Confirm the body is terse and on one topic. Flag a crowded file to split.

## Test

- Every written rule file exists. Its scope frontmatter matches its reach, or is absent for an all-files rule.
