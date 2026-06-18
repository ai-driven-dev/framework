---
name: plan
description: Parent plan template orchestrating multiple child plans with validation gates
status: pending
---

# Plan: {title}

## Overview

| Field          | Value              |
| -------------- | ------------------ |
| **Goal**       | {one-line summary} |
| **Risk Score** | {X}/10             |
| **Brainstorm** | `path/` (`none`)   |

## Plans

| #   | Plan         | File                    |
| --- | ------------ | ----------------------- |
| 1   | {phase-name} | [`./1_{phase}.md`](./#) |
| 2   | {phase-name} | [`./2_{phase}.md`](./#) |

## Risk register

<!-- Top technical risks that could derail implementation. Identify them upfront so the plan accounts for them. -->

| Risk     | Impact                        | Mitigation                            |
| -------- | ----------------------------- | ------------------------------------- |
| {risk 1} | {what breaks if this happens} | {how the plan prevents or handles it} |

## Decisions

| Decision | Why |
| -------- | --- |
|          |     |
