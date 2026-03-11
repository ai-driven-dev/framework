---
name: 'aidd:06:test'
description: 'List untested behaviors and iterate on test creation until tests pass with best practices'
argument-hint: [things you want to test]
---

# Test Iterator Prompt

## Goal

Identify untested behaviors in the feature, then create and iterate on tests until they pass with modern testing best practices.

## Context

- Current project testing framework and conventions
- Test coverage and quality metrics

### Testing rules

```markdown
@.claude/rules/
```

### Scope to test

```text
$ARGUMENTS
```

## Rules

- Focus on ONE test at a time
- Apply current testing best practices
- Continue iterating until test passes AND meets quality criteria
- Never compromise on test quality for speed
- Focus on functional aspects only, ignore technical details

## Process steps

1. List untested behaviors in the target area
   1. Think about behaviors to test based on existing ones
   2. Determine a score, 0: not needed, 5: critical core flow to test
   3. Group them by distinct sections
   4. Prioritize based on score and impact
   5. Display organized minimal bullet list of untested behaviors
2. **Wait for user approval**
3. Generate initial test with best practices
4. Run test and capture results
   1. If test fails: analyze failure, improve test, repeat from step 4
   2. If test passes: validate against quality checklist
   3. If quality insufficient: improve test quality, repeat from step 4
5. Move to next untested behavior, repeat from step 2
