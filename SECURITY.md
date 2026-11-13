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

## Out of scope

- Self-XSS, social engineering of contributors, or denial of service through legitimate features
- Third-party plugins not maintained in this repository
- Attacks that need physical access to a developer's machine
