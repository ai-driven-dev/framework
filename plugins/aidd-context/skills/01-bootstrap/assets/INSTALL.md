# INSTALL.md - `<project-name>`

Architecture decisions + install guide (ADR-style: what chosen, why, how to install).

## Vision

`<one-liner from checklist>`

`<2-3 sentences expanding on the value proposition, target users, and core differentiator>`

## Stack

| Decision     | Choice        | Why                                         |
| ------------ | ------------- | ------------------------------------------- |
| Architecture | `<pattern>`   | `<rationale tied to checklist constraints>` |
| Front-end    | `<framework>` | `<rationale>`                               |
| Back-end     | `<framework>` | `<rationale>`                               |
| Database     | `<engine>`    | `<rationale>`                               |
| Auth         | `<provider>`  | `<rationale>`                               |
| Hosting      | `<concrete>`  | `<rationale>`                               |

## Building blocks

Technical capabilities wired for this project - only ones the app needs.

| Block                     | Tech |
| ------------------------- | ---- |
| **Data**                  |      |
| **Auth**                  |      |
| **Email**                 |      |
| **File storage**          |      |
| **Background jobs**       |      |
| **Scheduled jobs** (CRON) |      |
| **Payments**              |      |
| **Logging/errors**        |      |

## Architecture

```mermaid
<rendered mermaid diagram from action 05>
```

`<2-3 sentences explaining the diagram: which modules talk to which, where the boundary is>`

## Install, configure, run, test

Prerequisites: `<runtime + version>`, `<package manager>`, `<database or the in-memory provider for local dev>`, `<container/runtime if the stack uses one>`.

```bash
<install command>
```

- Configure: set env vars the project needs (`<env vars>`); set data-provider flag (`<DB_PROVIDER_ENV>`) to `in-memory` (local) or the real provider.

```bash
<run command>
<test command>
```

Unit tests run against in-memory provider; end-to-end tests use the real one.
