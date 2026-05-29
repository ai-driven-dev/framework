# 04 - Dependencies audit

Read-only audit of the `dependencies` pillar: CVEs, license compliance, outdated packages, and supply-chain integrity. Reports findings, never edits code.

## Inputs

```yaml
scope: <directory or file glob>    # optional; defaults to the entire codebase
```

## Outputs

```yaml
audit_path: aidd_docs/tasks/audits/<yyyy>_<mm>_dependencies.md   # or <yyyy>_<mm>_full.md in a full run
pillar: dependencies
findings_count: <int>
```

## Process

1. **Load scope.** Default to the full codebase when `scope` is absent; otherwise restrict scanning to the provided glob or directory.
2. **Scan the dependencies lens** below using the appropriate dependency scanner. Stay in this pillar - application code security issues belong to `03-security`; runtime cost to `05-performance`.
   - **Known CVEs**: run `npm audit`, `pip-audit`, `cargo audit`, or the equivalent scanner for the project's package manager. If no scanner is available or no lockfile is present, record "scanner absent" or "no lockfile found" in Coverage > Skipped and do not guess CVEs.
   - **License compliance**: check declared licenses against the project's accepted-license list; flag GPL/AGPL or unknown licenses in a commercial codebase.
   - **Outdated packages**: identify packages significantly behind their latest stable release, especially those with security-relevant changelogs.
   - **Unused declared dependencies**: flag packages listed in the manifest but with no import found in the scanned source.
   - **Lockfile integrity and supply-chain**: verify the lockfile is present and committed; flag direct git/URL dependencies and any package with no integrity hash.
3. **Rate each finding.** Severity (🔴 / 🟡 / 🟢) and effort (S/M/L) per `@../assets/audit-template.md` legend. Quote a concrete `file:line` (manifest or lockfile line) for every finding. Category is always `dependencies`.
4. **Write the report** using `@../assets/audit-template.md`: fill the Findings table (one row per issue, severity-first), ranked Top actions (hand off upgrades to `aidd-dev:07:refactor` or manual upgrade), and the Coverage section. In a full audit run, contribute these finding rows to the single merged report per the skill output contract instead of writing a separate file. Read-only: emit the report and stop; do not edit code.

## Test

The output file exists at `audit_path`; it has the `## Findings`, `## Top actions`, `## Coverage` sections; every Findings row has a severity, category `dependencies`, a concrete `file:line`, and an effort; Coverage lists `dependencies` as scanned. No abstract "the codebase has..." sentences, no code changes made.
