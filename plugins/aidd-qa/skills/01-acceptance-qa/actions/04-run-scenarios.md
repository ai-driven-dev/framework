# 04 - Run Scenarios

## Input

Prepared scenarios and scope.

## Output

`<evidence-folder>/qa.md`.

## Process

1. **Run.** Apply setup and compare observed behavior to criteria only. CLI: record stdout and exit status. A mismatch => `fail`, else `pass`.
2. **Recover.** Setup failure, throw or unexpected non-zero exit: teardown, retry once; repeated failure => `blocked`.
3. **Reset.** Teardown mutations, verify baseline, close browser sessions.
4. **Report.** Record the observable condition and evidence per criterion, all rejections and limitations, even if nothing ran. Verdict: `fail` > `blocked` or rejected > `pass`; proof-weakening limitations => `blocked`. Findings only for `fail`/`blocked`. Return verdict and path.

## Test

Every scoped criterion has evidence or a blocker.
