---
objective: "Publish versioned AIDD marketplaces with each release and migrate the historical Claude Code URL."
status: implemented
---

# Plan: Release marketplace distribution

Source: [spec.md](spec.md)

## Phases

| # | Phase | File | Depends on |
| --- | --- | --- | --- |
| 1 | Publish and verify generated catalogs | [`phase-1.md`](./phase-1.md) | none |
| 2 | Preserve the legacy Claude catalog and document installation | [`phase-2.md`](./phase-2.md) | 1 |

## External sources

| URL | What it settled |
| --- | --- |
| https://code.claude.com/docs/en/plugins/host-marketplace | Git refs, legacy marketplace identity, and version refresh |
| https://developers.openai.com/plugins/build/plugins | Git-backed Codex catalogs and named refs |
| https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference | Catalog location, Git refs, and installation commands |
| https://cursor.com/docs/plugins | Team imports and tracking a Git branch |
| https://docs.github.com/en/actions/tutorials/authenticate-with-github_token | Cross-repository installation token |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| Runtime | The deployment uses GitHub, the existing AIDD App, and vendor clients. A live publication requires the new repository and the App's write grant. | 1 |
| Regression | Keep the existing `build-per-tool` assets. Verify the old Claude source, local bundle, and version behavior. | 1, 2 |
| Architecture | Release orchestration remains in CI and release scripts. Translation formats remain owned by the CLI. | 1, 2 |
| Documentation | Installation and compatibility guides reflect verified flows and explain deployment prerequisites. | 2 |

## Rules

| Rule | Why it applies |
| --- | --- |
| `make check` from `CONTRIBUTING.md` | Run the repository checks before review. |
| Target `next` for feature branches | `aidd_docs/memory/vcs.md` defines the PR base. |

## Decisions

| Decision | Why |
| --- | --- |
| Publish isolated tool branches in one distribution repository | Native layouts can occupy identical paths and Git-backed clients can select a ref. |
| Use a compatibility ref for Claude's historical catalog | Its original marketplace name and source URL still resolve after the two-release window. |
