# 04 - Save Evidence

Save the QA report and its media beside the feature plan and phases.

## Input

The QA scope, scenario verdicts, screenshots, requested WebM files, and the recording choice.

## Output

A `qa.md` report and a `qa/` media directory in the feature folder.

## Process

1. **Resolve.** Use the feature folder resolved from the plan. Create its `qa/` directory when evidence exists.
2. **Copy.** Save every retained WebM file and screenshot under `qa/` with a scenario-based name.
3. **Report.** Fill the QA report from the action asset. Include the scope, every verdict, each evidence path, and any invalidated scenario.
4. **Check.** Verify each path in the report exists. Omit edge-case video entries when the user selected happy-path coverage.

```md
@../assets/save-evidence-qa-report-template.md
```

## Test

- The task folder contains qa.md and each referenced media file exists.
