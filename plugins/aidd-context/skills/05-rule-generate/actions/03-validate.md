# 03 - Validate

Check each written rule file against the contract.

## Input

The list of files written (from 02).

## Output

A short pass or fail line per rule file.

## Process

1. **Operation.** Create/update/publish: confirm expected sources and publications exist. Delete: confirm the selected source and its native files or shared rule body are absent; remaining rules and user bytes survive.
2. **Contract.** For remaining files, validate against [rule-authoring.md](../references/rule-authoring.md) and confirmed intent, including exact literals.
3. **Target.** Validate target path and frontmatter against [tool-paths.md](../references/tool-paths.md).
   For Codex and OpenCode V2, each remaining body must appear once in the shared signed contribution; deleting the last shared rule removes that contribution. User guidance and memory bytes must survive, and rerunning the installed script with `--publish` must be byte-identical. Remaining native files retain complete bodies and scope syntax. Report publication separately from consumption; only real host evidence proves runtime use.
4. **Report.** Emit one pass/fail line per file.

## Test

Every affected rule has one pass/fail result for the requested operation and applicable contracts.
