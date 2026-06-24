# 01 - Create User Stories

Clarify scope through iterative Product Owner questioning, draft INVEST-compliant user stories, validate with the user, then save them to the configured ticketing tool.

## Input

The feature or requirement to break into stories (required), and optionally the ids of related stories to consider.

## Output

The saved stories, each with its tracker id and URL, title, `As a / I want / so that` statement, acceptance criteria, story points, and priority.

## Process

1. **Clarify.** Ask up to three questions per iteration to close gaps in problem, features, criteria, scope, and constraints. Skip technical detail.
2. **Iterate.** While a blocking question remains, loop back to Clarify. Otherwise proceed.
3. **Draft.** Format each story with `@../assets/user-story-template.md`, sorted by implementation priority.
4. **Validate.** Show the full story list and wait for explicit approval.
5. **Save.** Invoke the configured ticketing tool to create each story, capturing the returned id and URL.

## Test

- Each story satisfies INVEST: Independent, Negotiable, Valuable, Estimable, Small, Testable.
- Every story has acceptance criteria, addressed dependencies, and story points set.
- Querying the configured tool returns each saved story id with a matching title.
