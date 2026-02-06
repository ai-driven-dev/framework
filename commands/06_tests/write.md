---
name: write
description: Iterate on test creation and improvement until perfect test passes with best practices
---

# Perfect Test Iterator Prompt

## Goal

Create and iterate on a single test until it passes perfectly with modern testing best practices.

## Context

- Current project testing framework and conventions
- Test coverage and quality metrics

### Testing rules

```markdown
@{{TOOLS}}/rules/
```

## Rules

- Focus on ONE test at a time
- Apply current testing best practices
- Continue iterating until test passes AND meets quality criteria
- Never compromise on test quality for speed

## Process steps

1. Analyze test requirements and existing code context
2. Generate initial test with best practices
3. Run test and capture results
   1. If test fails: analyze failure, improve test, repeat from step 3
   2. If test passes: validate against quality checklist
   3. If quality insufficient: improve test quality, repeat from step 3
