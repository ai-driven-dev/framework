# Brief - AIDD CLI

**Date**: 2026-02-26
**Status**: Draft

---

## XYZ Formula

| Element         | Description                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **X (Product)** | A CLI tool that generates AI coding assistant configurations from a single canonical framework, with stateful tracking for non-destructive updates |
| **Y (Persona)** | Developers in a paid community who use multiple AI coding assistants and need consistent, up-to-date configurations across all of them             |
| **Z (Outcome)** | 70% community adoption within 6 months, reducing manual configuration effort to a single command per tool                                          |

---

## Context

Development teams increasingly use multiple AI coding assistants simultaneously — each with its own directory structure, file format, frontmatter syntax, and include conventions. Maintaining consistent agent definitions, rules, commands, and skills across these tools is manual, error-prone, and time-consuming. When the framework evolves, updating each tool's configuration individually leads to drift, broken references, and lost customizations.

The AIDD community has built a proprietary framework of agents, commands, rules, skills, and templates that standardize AI-assisted development practices. Today, distributing this framework to each tool requires manual adaptation. Members waste time translating the same content into different formats and risk inconsistencies that degrade their AI assistant's effectiveness.

---

## Target User

Developers who are active members of the AIDD paid community, work on multiple projects, and use at least two AI coding assistants daily. They are comfortable with CLI tools and value automation over manual repetition. They contribute to and consume the shared framework regularly.

**Adoption risk**: the CLI requires Node.js >= 20. The package manager (npm, pnpm, yarn) should not matter — the CLI is installed via npx or global install, not tied to a specific package manager. If a significant portion of the community does not already have Node.js, this is a barrier. Mitigation: validate Node.js prevalence in the community before launch; consider standalone binary distribution if adoption is blocked.

**User insights**:

- Config drift between tools causes subtle but costly issues: AI assistants give inconsistent suggestions, rules are applied in one tool but missing in another
- Framework updates are dreaded because applying them means manually checking each tool's files, risking overwrite of local customizations
- Developers who switch between AI assistants within the same project lose the most time to format translation

---

## Solution

**v3.0 scope**: A single CLI command (`aidd install`) that takes the canonical framework and generates tool-specific distributions with correct directory structures, file extensions, frontmatter formats, include syntax, and content references. A manifest tracks every generated file with hash-based change detection. Status checking (`aidd status`), uninstallation (`aidd uninstall`), and full cleanup (`aidd clean`) complete the core lifecycle.

**v3.1+ scope (deferred)**: Non-destructive updates (`aidd update` skips user-modified files), targeted restoration (`aidd restore`), and cross-tool synchronization (`aidd sync`). These are deferred until validated by community demand.

The framework itself describes its structure via a descriptor file, so the CLI adapts automatically when the framework evolves — no code changes needed for framework reorganization.

---

## Differentiation

Existing tools approach the multi-tool problem differently:

- **BMAD Method** (v6.0, open source) focuses on workflow orchestration and methodology with 21+ specialized agents. It generates its own `.bmad` config but does not translate content between tool formats or track installation state. Different category: methodology tool, not distribution tool.
- **Spec Kit** (GitHub, open source, v0.1.4) generates per-agent config files for 13+ assistants with spec-driven development focus. Broader tool coverage but no manifest tracking, hash-based change detection, or non-destructive updates. **Risk**: Spec Kit could add stateful tracking. **Mitigation**: AIDD CLI's value is depth (proprietary framework content + community-specific workflows), not breadth. Spec Kit serves generic spec-driven development; AIDD CLI serves a specific community's proprietary framework. The defensible moat is the framework content and community, not the distribution mechanism alone.
- **ai-rules-sync** (open source) offers basic rule synchronization but without manifest state, version tracking, or bidirectional content rewriting.
- **ClaudeMDEditor** (paid) provides a GUI for browsing and editing config files across repos but does not generate distributions from a canonical source or track state.

AIDD CLI's unique angle is **stateful distribution management for a proprietary framework**: it tracks every generated file, detects user modifications, prevents data loss, and adapts to framework evolution via the descriptor — all in service of a specific community's curated content.

---

## Hypotheses to Validate

| #   | Hypothesis                                                                | Validation Method                                                                                                        |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| H1  | Teams using 2+ AI assistants waste significant time on config maintenance | Pre-validated: community demand created the product. To strengthen: quantify via post-launch survey.                     |
| H2  | Manual sync leads to config drift causing inconsistent AI behavior        | Pre-validated: NEEDS.md §2.1 documents this from community experience. To strengthen: collect specific incident reports. |
| H3  | Users fear losing customizations during framework updates                 | Pre-validated: non-destructive update design was driven by explicit community request.                                   |
| H4  | CLI is the right interface (vs GUI, IDE plugin)                           | Pre-validated: community is CLI-proficient. Risk: if community grows beyond developers, this assumption weakens.         |
| H5  | Hash-based change detection is sufficient for conflict management         | To validate: monitor community issues post-launch for edge cases requiring content-level diffing                         |
| H6  | Framework descriptor decoupling provides real value                       | To validate: measure framework structure changes over 6 months and whether CLI adapts without code changes               |
| H7  | Cross-tool propagation (sync) is a real need                              | To validate: defer to v3.1+, track community requests explicitly                                                         |
| H8  | Initial tool set covers >80% of community usage                           | To validate: pre-launch survey on tool usage distribution. Critical: if unvalidated, v3.0 value proposition weakens.     |

**Failure criteria** (from constitution): below 15% adoption at month 3 triggers a community feedback sprint to diagnose adoption blockers. If tool coverage (H8) is invalidated pre-launch, reprioritize tool support before shipping.

---

## Sources

| Element                                       | Source                                         | Type |
| --------------------------------------------- | ---------------------------------------------- | ---- |
| Problem statement, user flows, architecture   | NEEDS.md (internal specification)              | qual |
| Community pain points, feature prioritization | Constitution (internal, from community input)  | qual |
| BMAD Method capabilities and positioning      | GitHub repo, official docs, community articles | qual |
| Spec Kit capabilities and distribution model  | GitHub blog, official docs, PyPI               | qual |
| ai-rules-sync feature set                     | GitHub repo                                    | qual |
| ClaudeMDEditor capabilities                   | Product website                                | qual |
| AI coding assistant landscape 2026            | Industry articles, comparison reviews          | qual |
