# Constitution - AIDD CLI

## Vision

AIDD CLI enables development teams to maintain a single canonical AI-Driven Development framework and distribute it consistently across multiple AI coding assistants (e.g. Claude Code, Cursor, GitHub Copilot) — eliminating the error-prone, time-consuming work of keeping tool-specific configurations in sync. It is the distribution backbone for a private paid community of AI-assisted developers. Both the CLI and the framework content it distributes are proprietary to the community, distributed via GitHub Packages and gated by a membership authentication token.

## North Star Metric

- **Metric**: Community adoption rate — percentage of active community members who have installed the CLI in at least one project
- **Success threshold**: 70% adoption rate within 6 months of launch; checkpoint at 30% by month 3 (below 15% triggers a community feedback sprint)
- **Measurement method**: GitHub Packages download counts cross-referenced with community membership roster. Supplemented by quarterly NPS survey (target: >40) and GitHub issue volume as engagement signal.

## Non-negotiable Constraints

| Category | Constraint | Justification |
| --- | --- | --- |
| Technical | Must work offline for all local operations (init, install, status, sync, uninstall, clean, doctor). Restore and update require cached framework source or network access. | Users in restricted environments must not be blocked; restore/update depend on framework content which must be cached at install time for offline use |
| Technical | Adding a new AI tool requires only: a new tool specification, a content rewriter, and a frontmatter formatter. No changes to use cases, CLI commands, manifest tracking, or propagation logic. | The community uses diverse AI tools and new ones emerge regularly; extensibility is a survival condition |
| Quality | Every managed file must be tracked with hash-based change detection — no silent overwrites | Trust is the product: users must never lose work without explicit consent |
| Quality | All user-facing operations must be non-destructive by default; destructive actions require explicit flags or confirmation | Prevents accidental data loss in a tool that writes and deletes files across the project |
| Security | Authentication tokens are never cached, logged, or displayed by the CLI | The framework repository is private; leaking tokens breaks the community's access model |
| Budget | Maximum 2 direct runtime dependencies (in `dependencies`, not `devDependencies`). Node.js built-in modules do not count. | Reduces supply chain risk and maintenance burden for a small team |
| Timeline | Ship v3.0.0 with init, install, uninstall, status, and clean; defer sync, update, restore to v3.1+ | Ship fast, validate with real users, then iterate on advanced workflows |

## Decision Rules

1. When in doubt between a feature and shipping, ship — the community needs a working tool before a complete one
2. When a tool vendor changes its configuration format, treat it as a highest-priority bug — broken distributions erode trust immediately
3. When the framework structure evolves within existing content categories (agents, commands, rules, skills, templates, docs), the CLI must adapt without code changes — the framework descriptor is the contract, not hardcoded paths. New content categories may require code changes.
4. When user modifications conflict with framework updates, the user's work always wins by default — overwriting requires explicit intent
5. When choosing between clever abstractions and readable code, choose readable — the team must onboard contributors quickly
6. When a CLI update changes the manifest format or framework descriptor schema, the CLI must migrate existing installations automatically — users must never be required to re-init or re-install

## Anti-over-engineering

- Do not build propagation (sync) until community feedback confirms cross-tool sync is a real pain point, not a theoretical one
- Do not add caching optimizations until users report download latency as a pain point
- Do not implement support for a new AI tool until a concrete community request exists — extensibility in the architecture is enough, no speculative implementations
- Do not build a plugin system or configuration UI — the CLI is the interface, the framework descriptor is the configuration
- Keep the framework descriptor minimal — it describes file layout and content types, not transformation rules or business logic
