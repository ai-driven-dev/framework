# 01 - Challenge

## Input

- **Work:** the last answer, files, a plan, or a commit range.
- **Reference:** the agreed plan, spec, or stated user intent.

## Output

The evidence-backed verdict and findings in [report-template.md](../assets/report-template.md).

## Process

1. **Trace.** Compare the work with the reference and actual contracts of the capabilities it invokes.
2. **Challenge.** Find outcome failures, unsupported assumptions, essential gaps, contradictions, and removable duplication.
3. **Classify.** Separate blockers to the intended outcome from optional suggestions, linking each to evidence and the smallest fix.
4. **Report.** Return the template with verified strengths and any evidence limits.

## Rules

- **Read-only:** never modify the work.
- **Evidence:** mark an unverified claim as such; missing essential evidence blocks a ready verdict.
- **Simplicity:** prefer removing or consolidating instructions over adding another rule.
