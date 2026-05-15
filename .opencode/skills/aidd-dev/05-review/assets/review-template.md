---
name: code-review
description: Code review checklist and scoring template
argument-hint: N/A
---

# Code Review for {feature}

{{summary}}

- Statuts: {{status}}
- Confidence: {{confidence}}

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)
  - [Potentially Unnecessary Elements](#potentially-unnecessary-elements)
  - [Standards Compliance](#standards-compliance)
  - [Architecture](#architecture)
  - [Code Health](#code-health)
  - [Security](#security)
  - [Error management](#error-management)
  - [Performance](#performance)
  - [Frontend specific](#frontend-specific)
  - [Backend specific](#backend-specific)
- [Final Review](#final-review)

## Main expected Changes

- [ ] Feature A implementation
- [ ] API endpoint for X
- [ ] Database migration for Y

## Scoring

Fill the checklist under with:

- [🟢|🟡|🔴] [**{category}**]: `{affected file:line}` {issue} ({quick suggestion})

Example :

- [🟢] SQL injection risks
- [🟡] **Memory leaks checked** `LivePreview.tsx:43` Variable user is recalculated on every render (put this inside a `useEffect` hook...)

## Code Quality Checklist

### Potentially Unnecessary Elements

- [ ]

### Standards Compliance

- [ ] Naming conventions followed
- [ ] Coding rules ok

### Architecture

- [ ] Design patterns respected
- [ ] Proper separation of concerns

### Code Health

- [ ] Functions and files sizes
- [ ] Cyclomatic complexity acceptable
- [ ] No magic numbers/strings
- [ ] Error handling complete
- [ ] User-friendly error messages implemented

### Security

- [ ] SQL injection risks
- [ ] XSS vulnerabilities
- [ ] Authentication flaws
- [ ] Data exposure points
- [ ] CORS configuration
- [ ] Environment variables secured

### Error management

- [ ]

### Performance

- [ ]

### Frontend specific

#### State Management

- [ ] Loading states implemented
- [ ] Empty states designed
- [ ] Error states handled
- [ ] Success feedback provided
- [ ] Transition states smooth

#### UI/UX

- [ ] Consistent design patterns
- [ ] Responsive design implemented
- [ ] Accessibility standards met
- [ ] Semantic HTML used

### Backend specific

#### Logging

- [ ] Logging implemented

## Final Review

- **Score**: {{final_score}}
- **Feedback**: {{feedback}}
- **Follow-up Actions**: {{follow_up_actions}}
- **Additional Notes**: {{additional_notes}}
