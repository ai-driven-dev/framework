# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in the AI-Driven Dev framework or any of its plugins, please report it privately via [GitHub Security Advisories](https://github.com/ai-driven-dev/aidd-framework/security/advisories/new).

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

## Operational risks worth knowing

These are documented design decisions, not vulnerabilities to report - but they should inform how you operate the framework.

- **`--permission-mode bypassPermissions` inside GitHub Actions.** The orchestrator runs `claude-code-action` with bypassed permission prompts so the pipeline can complete unattended. Inside the runner Claude can execute any tool the runner allows (filesystem, network, shell, gh CLI). Anyone who can apply a trigger label or post a trigger mention is effectively running Claude on your repo. Restrict the trigger labels to trusted contributors via branch / repo settings if your repo accepts community input.
- **PAT scope breadth.** The `github_write_auth` PAT carries `Contents`, `Pull requests`, `Issues`, `Workflows`, `Metadata` read/write on the target repo. Treat the secret as a powerful credential; rotate every 90 days; do not reuse across repos.
- **Marketplace clone surface.** Installing this marketplace executes its `SKILL.md` actions, hooks, and any MCP servers it declares. Review the artifacts before adding the marketplace to a new repo.

## Out of scope

- Self-XSS, social engineering attacks against contributors, or denial-of-service via legitimate features.
- Vulnerabilities in third-party plugins not maintained in this repository.
- Vulnerabilities requiring physical access to a developer's machine.

Thank you for helping keep the AI-Driven Dev community safe.
