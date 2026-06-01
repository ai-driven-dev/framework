# 01 - Code-quality audit

Read-only audit of the `code-quality` pillar: clean-code craftsmanship and tech debt. Reports findings, never edits code.

## Inputs

```yaml
scope: <directory or file glob>    # optional; defaults to the entire codebase
```

## Outputs

```yaml
audit_path: aidd_docs/tasks/audits/<yyyy>_<mm>_code-quality.md   # or <yyyy>_<mm>_full.md in a full run
pillar: code-quality
findings_count: <int>
```

## Process

1. **Load scope.** Default to the full codebase when `scope` is absent; otherwise restrict scanning to the provided glob or directory.
2. **Scan the two lenses** below, using the project's conventions and coding rules already loaded in context. Stay in this pillar - architecture coupling belongs to `02-architecture`, runtime cost to `05-performance`, coverage to `06-tests`, CVEs to `04-dependencies`.
   - **Clean code (craftsmanship)**: naming clarity, single-responsibility / SOLID, DRY (copy-pasted logic, re-implemented stdlib helpers), readability, abstraction level, magic numbers, dead or misleading comments, code smells.
   - **Tech debt (structural)**: dead and unreachable code, unused exports/types/helpers, stale TODOs, vestigial flags, cyclomatic complexity and file/function/component length above project thresholds, nesting depth, error handling caught at the wrong boundary or silently swallowed.
   - Use dedicated tools when available (e.g. an unused-export finder); never assert dead code without evidence.
3. **Rate each finding.** Severity (🔴 / 🟡 / 🟢) and effort (S/M/L) per `@../assets/audit-template.md` legend. Quote a concrete `file:line` for every finding. Category is always `code-quality`.
4. **Write the report** using `@../assets/audit-template.md`: fill the Findings table (one row per issue, severity-first), ranked Top actions (hand off fixes to `aidd-dev:07-refactor`), and the Coverage section. In a full audit run, contribute these finding rows to the single merged report per the skill output contract instead of writing a separate file. Read-only: emit the report and stop; do not edit code.

## Test

The output file exists at `audit_path`; it has the `## Findings`, `## Top actions`, `## Coverage` sections; every Findings row has a severity, category `code-quality`, a concrete `file:line`, and an effort; Coverage lists `code-quality` as scanned. No abstract "the codebase has..." sentences, no code changes made.
