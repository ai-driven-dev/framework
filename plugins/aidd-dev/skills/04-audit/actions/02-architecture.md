# 02 - Architecture audit

Read-only audit of the `architecture` pillar: conformance to documented architecture, module coupling, and layer/boundary violations. Reports findings, never edits code.

## Inputs

```yaml
scope: <directory or file glob>    # optional; defaults to the entire codebase
```

## Outputs

```yaml
audit_path: aidd_docs/tasks/audits/<yyyy>_<mm>_architecture.md   # or <yyyy>_<mm>_full.md in a full run
pillar: architecture
findings_count: <int>
```

## Process

1. **Load scope.** Default to the full codebase when `scope` is absent; otherwise restrict scanning to the provided glob or directory.
2. **Scan the architecture lens** below, using architecture documents already loaded in context (`aidd_docs/memory`, ADRs, C4 diagrams). Stay in this pillar - intra-file craftsmanship belongs to `01-code-quality`; runtime cost to `05-performance`; CVEs to `04-dependencies`.
   - **Conformance**: map the actual code structure against documented modules, layers, and C4 boundaries; flag any divergence from the stated architecture.
   - **Coupling**: identify modules that import from layers they should not depend on (wrong dependency direction: outward imports into an inner layer, or circular references across bounded contexts).
   - **God-modules**: detect modules with an abnormally large surface area (too many exports, too many responsibilities) that signal architectural erosion.
   - When ADRs or C4 diagrams are absent, note "no architecture docs found - conformance check skipped" in Coverage > Skipped and limit the scan to observable coupling heuristics.
3. **Rate each finding.** Severity (🔴 / 🟡 / 🟢) and effort (S/M/L) per `@../assets/audit-template.md` legend. Quote a concrete `file:line` for every finding. Category is always `architecture`.
4. **Write the report** using `@../assets/audit-template.md`: fill the Findings table (one row per issue, severity-first), ranked Top actions (conformance gaps feed re-planning; structural fixes hand off to `aidd-dev:07:refactor`), and the Coverage section. In a full audit run, contribute these finding rows to the single merged report per the skill output contract instead of writing a separate file. Read-only: emit the report and stop; do not edit code.

## Test

The output file exists at `audit_path`; it has the `## Findings`, `## Top actions`, `## Coverage` sections; every Findings row has a severity, category `architecture`, a concrete `file:line`, and an effort; Coverage lists `architecture` as scanned. No abstract "the codebase has..." sentences, no code changes made.
