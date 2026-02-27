---
name: ux_copy
description: UX copy template — single source of truth for ALL user-facing text
argument-hint: N/A
---

# UX Copy - [Project Name]

## Scope

**This document owns**: ALL user-facing text — error messages, empty states, tooltips, onboarding copy, CTAs, confirmation messages, notification text, form labels, placeholder text.

**No other deliverable should contain exact user-facing text.** Other documents reference this one.

## 1. Voice & Tone

### Product Voice

[Personality traits: professional, friendly, technical, casual, etc.]

### Tone Variations

| Context | Tone | Do | Don't |
|---------|------|----|-------|
| Success | [Celebratory but not excessive] | [Example] | [Counter-example] |
| Error | [Empathetic and actionable] | [Example] | [Counter-example] |
| Empty state | [Encouraging and guiding] | [Example] | [Counter-example] |
| Onboarding | [Welcoming and clear] | [Example] | [Counter-example] |

## 2. Error Messages

| Key | Message | Recovery action | Context |
|-----|---------|----------------|---------|
| `error.{domain}.{type}` | [Non-technical, actionable message] | [What user should do] | [When this appears] |

## 3. Empty States

| Key | Message | CTA | Context |
|-----|---------|-----|---------|
| `empty.{domain}.{context}` | [Contextual message explaining why it's empty] | [Action to populate] | [When this appears] |

## 4. Tooltips

| Key | Text | Component |
|-----|------|-----------|
| `tooltip.{domain}.{element}` | [Max 1 sentence] | [Which UI element] |

## 5. Onboarding

| Key | Step | Text |
|-----|------|------|
| `onboarding.welcome.title` | Welcome | [Welcome message] |
| `onboarding.{step}.{element}` | [Step N] | [Guidance text] |

## 6. CTAs

| Key | Label | Context | Notes |
|-----|-------|---------|-------|
| `cta.{domain}.{action}` | [Action verb — Create, Save, Send, not OK/Submit] | [Where used] | [Consistency group] |

## 7. Confirmation & Notification Messages

| Key | Message | Type | Context |
|-----|---------|------|---------|
| `confirm.{domain}.{action}` | [Message] | [Success / Warning / Info] | [When displayed] |
