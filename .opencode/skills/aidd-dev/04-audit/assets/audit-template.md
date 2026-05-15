---
name: audit
description: Codebase audit report template
argument-hint: N/A
---

# Codebase Audit for {scope}

{{summary}}

- Status: {{status}}
- Confidence: {{confidence}}
- Scope: {{scope}}

## Findings

Fill the checklist under with:

```markdown
- [🟢|🟡|🔴] [**{category}**]: `{affected file:line}` {issue} ({suggested fix})
```

Example:

```markdown
- [🔴] **Dead code**: `src/legacy/utils.ts:120` Unused export `formatLegacyDate`, no inbound references (delete the function and its imports)
- [🟡] **Duplication**: `src/views/login.tsx:45` Same toast logic copy-pasted in 3 views (extract a `useToast` helper)
- [🟢] **Coverage**: `src/services/auth.ts` Critical path covered by integration tests
```

## ✅ Audit Checklist

### Dead and unused code

- [ ] Unreachable code paths
- [ ] Unused exports, types, helpers
- [ ] Stale comments, TODOs older than 6 months
- [ ] Vestigial feature flags

### Duplication

- [ ] Same logic copy-pasted across files
- [ ] Re-implemented standard library helpers
- [ ] Repeated test setup blocks

### Complexity

- [ ] Cyclomatic complexity per function within target
- [ ] File length within target
- [ ] Component or class scope within target
- [ ] Nesting depth within target

### Standards and conventions

- [ ] Naming conventions followed
- [ ] Project coding rules respected
- [ ] Linting and formatting clean
- [ ] Folder structure matches architecture

### Error handling

- [ ] Errors caught at the right boundary
- [ ] User-facing messages clear
- [ ] No silent swallows
- [ ] Recovery paths tested

### Test coverage

- [ ] Critical paths covered
- [ ] Tests assert behavior, not implementation
- [ ] No flaky tests
- [ ] No skipped or xfailed without recorded reason

### Performance

- [ ] N+1 queries flagged
- [ ] Heavy operations batched or memoized
- [ ] Large payloads paginated
- [ ] Hot paths benchmarked when meaningful

### Security

- [ ] Input validation at boundaries
- [ ] Secrets never committed
- [ ] Dependencies free of known critical CVEs
- [ ] Authentication and authorization gates verified

## Recommendations

Ranked by impact (high to low):

1. {{rec_1}}
2. {{rec_2}}
3. {{rec_3}}

## Final Audit

- **Score**: {{final_score}}
- **Top risks**: {{top_risks}}
- **Quick wins**: {{quick_wins}}
- **Follow-up actions**: {{follow_up_actions}}
- **Additional notes**: {{additional_notes}}
