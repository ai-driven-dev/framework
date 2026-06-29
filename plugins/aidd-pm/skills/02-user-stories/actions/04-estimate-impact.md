# 04 - Estimate impact

Rate each story for effort and for its impact on the existing system.

## Input

The drafted stories from `03-draft-stories`.

## Output

Each story annotated with story points, its dependencies (named or confirmed absent), an impact rating of minor, major, or critic, and a one-line rationale for the impact.

## Process

1. **Estimate effort.** Assign story points reflecting relative size. Flag any story too large to size and send it back to `02-split-epic`.
2. **Rate impact.** Assign minor, major, or critic per the impact scale in `@../references/rating.md`.
3. **Justify.** Write a one-line rationale for each impact rating.
4. **Record.** Fill the estimation block in `@../assets/user-story-template.md` for each story.

## Test

- Each story carries a numeric story-point value.
- Each story carries an impact rating in {minor, major, critic} with a one-line rationale.
