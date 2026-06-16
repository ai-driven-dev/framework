# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in the AI-Driven Dev framework or any of its plugins, please report it privately via [GitHub Security Advisories](https://github.com/ai-driven-dev/framework/security/advisories/new).

If GitHub Security Advisories are unreachable, email `security@ai-driven-dev.fr` instead. PGP-encrypted reports are accepted on request to the same address.

Do not file public issues for security problems. Public disclosure before a fix is available gives attackers time to exploit the issue.

## What to include

- A short description of the issue and its impact.
- Steps to reproduce, or proof-of-concept code when possible.
- Affected plugin(s) and version(s).
- Any suggested fix or mitigation, if known.

## What to expect

- We acknowledge receipt within 5 business days.
- We work with you privately to confirm the issue and prepare a fix.
- Once a fix is ready, we publish a coordinated security advisory and credit you in the release notes (unless you prefer to remain anonymous).
- We aim to ship a patch release within 30 days of a confirmed report.

## Supported versions

| Version       | Supported              |
| ------------- | ---------------------- |
| Latest stable | Yes                    |
| Previous major| Critical fixes only    |
| Older majors  | No                     |

## Operational note

Installing this marketplace lets its plugins run `SKILL.md` actions, hooks, and any MCP servers they declare through your AI tool. Review a plugin's artifacts before installing it. Any plugin that runs in CI or with elevated permissions documents its own risks and required secrets in **that plugin's README** - read it before enabling such a plugin on a repo that accepts community input.

## Out of scope

- Self-XSS, social engineering attacks against contributors, or denial-of-service via legitimate features.
- Vulnerabilities in third-party plugins not maintained in this repository.
- Vulnerabilities requiring physical access to a developer's machine.

Thank you for helping keep the AI-Driven Dev community safe.
