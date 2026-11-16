# Third-party licenses

| Shipped | Third-party code inside | Licenses |
| --- | --- | --- |
| Plugin bundle (`plugins/`, `.claude-plugin/`) | none | - |
| npm package `@ai-driven-dev/cli` | none: dependencies stay external, npm installs them | `cd cli && pnpm licenses list --prod` |
| Development tooling | not shipped | `pnpm licenses list --dev` |

## Referenced, not redistributed

| Source | Use |
| --- | --- |
| [Claude Code](https://www.anthropic.com/) plugin marketplace | target format |
| [Contributor Covenant](https://www.contributor-covenant.org/) | Code of Conduct |
| [SchemaStore](https://www.schemastore.org/) | validation schemas |

> Code copied into the plugin bundle or the CLI build goes here, with its license and copyright, before merging.
