# Security policy

## Report a vulnerability

Never in a public issue.

| Step | Do |
| --- | --- |
| 1 | Open a private [GitHub Security Advisory](https://github.com/ai-driven-dev/framework/security/advisories/new) |
| 2 | If GitHub is unreachable, email `security@ai-driven-dev.fr`. PGP-encrypted reports are accepted on request. |

Include:

- What the issue is, and its impact
- How to reproduce it
- The affected plugin and version
- A fix, if you know one

## What happens next

| When | What |
| --- | --- |
| Within 5 business days | We acknowledge your report |
| After that | We confirm the issue and prepare a fix with you, privately |
| When the fix is ready | We publish an advisory and credit you, unless you prefer to stay anonymous |
| Within 30 days of confirmation | We aim to ship a patch release |

## Supported versions

| Version | Supported |
| --- | --- |
| Latest stable | Yes |
| Previous major | Critical fixes only |
| Older majors | No |

## Before you install a plugin

A plugin can run its skills, hooks and the MCP servers it declares, through your AI tool. Read a plugin's files before you install it. Take extra care with any plugin that runs in CI or with elevated permissions.

## Out of scope

- Self-XSS, social engineering of contributors, or denial of service through legitimate features
- Third-party plugins not maintained in this repository
- Attacks that need physical access to a developer's machine
