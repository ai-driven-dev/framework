# 01 - Create User Stories

Clarify scope through iterative Product Owner questioning, draft INVEST-compliant user stories, validate with the user, then save them to the configured ticketing tool.

## Inputs

```yaml
feature_description: <free text>   # required; the feature or requirement to break into stories
existing_stories: [<id>]            # optional; ids of related stories to consider
```

## Outputs

```yaml
stories:
  - id: <tracker id>
    title: <user story title>
    story: As a <persona>, I want <goal>, so that <reason>.
    acceptance_criteria:
      - <criterion>
    story_points: <int>
    priority: <int>
    url: <tracker url>
```

## Process

1. **Clarify**. Ask up to 3 questions per iteration to close gaps in problem, features, criteria, scope, and constraints. Skip technical detail.
2. **Iterate**. Pick first match:
   - blocking question remains -> loop back to step 1
   - no blocking question -> proceed
3. **Draft**. Format each story with `assets/user-story-template.md`. Sort by implementation priority.
4. **Validate**. Show the full story list to the user. Wait for explicit approval.
5. **Save**. Invoke the configured ticketing tool to create each story; capture the returned id and url.
6. **Return** the structured Outputs block.

## Test

- **INVEST**: each story satisfies Independent, Negotiable, Valuable, Estimable, Small, Testable.
- **Ready**: every story has acceptance criteria, dependencies addressed, and story points set.
- **Persisted**: querying the configured ticketing tool returns each saved story id with matching title.
