# 03 - Review

Challenge every claim of the drafts and let the user decide their wording and what goes public.

## Input

The drafts from draft and the fact sheet behind them.

## Output

The drafts approved by the user, or their corrections sent back to draft.

## Process

1. **Trace.** Test each line of each draft against its fact sheet row, and flag any claim stronger than its source.
2. **Expose.** Flag every publication risk the customer draft carries per [audiences.md](../references/audiences.md).
3. **Present.** Show the flags, the open TBD markers, and the drafts together.
4. **Decide.** Ask the user to approve the wording and choose what is public, one open question per unresolved flag.
   - Corrections or answered TBD markers: send them back to draft.
   - A customer draft still holds a TBD marker: it cannot be approved for sharing.

## Test

| Case | Pass |
| --- | --- |
| A line overstates its source | it is flagged with the fact sheet row it contradicts |
| The customer draft names a flagged risk | the risk is shown to the user, and the line is neither kept nor dropped silently |
| The user asks for changes | the drafts return to draft and are shown again |
| A customer draft holds a TBD marker | it is not marked approved |
| The review runs | no file is written |
