# 02 - Recommend

Produce the smallest supported remedies, each attributed to its owner.

## Input

Transcripts, session reports, verified sources and measurements.

## Process

1. Attribute each finding to framework text, a delegation brief, the host or environment, or the project.
   - Verify provenance rather than treating all instructions as framework text.
2. Identify the shortest equally reliable path to the result and the smallest reusable improvement.
3. Connect each finding's evidence to its cause, observed impact, remedy and validation.
   - Classify the cause as established, hypothesis or unknown.
   - Distinguish observed failure from explanation, and a proposed check from one already run.
   - State material tradeoffs and omit fields that add no useful information.
4. Prepare exact before/after text and a short execution prompt only for verified framework-text or delegation-brief edits.
   - Verify the maintained relative path and the instruction actually read.
   - Give host and project findings an operational remedy and validation without a patch.
5. Check every finding against its cited evidence and remove unsupported claims or edits.
   - If no supported improvement remains, state that result.
6. Continue to [target edits](03-target-edits.md).

## Output

Findings ordered by observed impact, with verified textual edits where applicable.

## Rules

- **Smallest remedy:** prefer removal or consolidation over new instructions.
