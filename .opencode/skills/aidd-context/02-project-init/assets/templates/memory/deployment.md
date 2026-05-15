---
name: deployment
description: Infrastructure and deployment documentation
argument-hint: N/A
scope: all
---

# Deployment

## CI/CD Pipeline

### <ci_flow>

- **Steps**:
  1. [Step 1]: [Description]
  2. [Step 2]: [Description]
  3. [Step 3]: [Description]

- **Test Automation**:
  - Unit tests: [When and how they run]
  - Integration tests: [When and how they run]
  - E2E tests: [When and how they run]

- **Deployment Triggers**:
  - Manual deployments: [Process]
  - Automated deployments: [Triggers and conditions]

## Monitoring & Logging

- **Monitoring Tools**: [Tools used for monitoring]
  - Application monitoring: [Tool and configuration]
  - Infrastructure monitoring: [Tool and configuration]
  - Performance monitoring: [Tool and configuration]

- **Logging**:
  - Log aggregation: [Tool and configuration]
  - Log levels: [How log levels are used]
  - Log retention: [How long logs are kept]

- **Alert Configuration**:
  - Critical alerts: [What triggers critical alerts]
  - Warning alerts: [What triggers warning alerts]
  - Alert channels: [How alerts are sent]

## Deployment Process

- **Deployment Steps**:
  - Database migration process

- **Rollback Procedure**:
  1. [Step 1]: [How to identify need for rollback]
  2. [Step 2]: [How to perform rollback]
  3. [Step 3]: [How to verify rollback success]

# Infrastructure

<!--
IMPORTANT: THOSE ARE RULES FOR AI, DO NOT USE THOSE INTO FILLED TEMPLATE.

- THIS FILE ANSWERS: WHERE does it run and HOW is it deployed?
- INCLUDE ONLY: URLs, environments, CI/CD, monitoring, deployment, how tests execute
- DO NOT INCLUDE: What tech stack, code organization, visual design, business logic
-->

## Project Structure

```plaintext
{{Minimal project structure diagram with paths}}
```

## Environments Variables

### Environment Files

### Required Environment Variables

## URLs

- **Development**:
  - URL: [Development URL]
  - Purpose: [Local development]

- **Production**:
  - URL: [Production URL]
  - SLA: [Service level agreements]

## Containerization

```mermaid
flowchart LR
    A[TODO]
%% {{Containerization architecture diagram with paths}}
```
