# 02 - Security

Identify and fix security vulnerabilities, then strengthen the codebase by adding test coverage and documentation for the fixes. Security may change observable behavior to close a vulnerability - this is expected and must be called out explicitly.

## Inputs

```yaml
scope: <directory or file glob>   # optional; defaults to the entire codebase
audit_report: <optional - path to a report under aidd_docs/tasks/audits/ or pasted findings>
focus_areas:
  - input_validation
  - authentication_authorization
  - injection
  - secrets_handling
```

## Outputs

```yaml
findings:
  - { id: <CWE or OWASP category>, file: <path>, severity: "🔴 critical | 🟡 warning | 🟢 minor", summary: <one-line> }
fixes_applied:
  - { id: <id>, file: <path>, change: <one-line summary>, behavior_change: <true|false - true if the fix alters observable behavior>, test_added: true|false }
```

## Process

1. **Source findings.** Two modes:
   - If `audit_report` is provided: extract the security-axis findings from that report and use them as the fix list. Skip steps 2-4 below.
   - Else (standalone): scan the scope for vulnerabilities using static analysis where available and a manual pass against OWASP Top 10. Continue with steps 2-4.
2. **Check input validation** at every external boundary (HTTP handlers, CLI args, file parsers, IPC).
3. **Review authentication and authorization** paths; flag missing checks and broken role propagation.
4. **Identify injection risks** (SQL, command, template, XSS, SSRF).
5. **Apply fixes**, preferring secure functions, least privilege, and parameterized APIs over ad-hoc sanitization. If a fix changes observable behavior, set `behavior_change: true` and explain the change inline.
6. **Add security test coverage** for each fix (regression unit or integration tests).
7. **Document the security measures** added or changed (inline doc strings, ADRs, or `aidd_docs/memory/` entries) so they are not regressed by future refactors.

Note: CVE dependency upgrades and version maintenance are out of scope for this action; they belong to dependency maintenance (a separate audit pillar). Route those findings there.

## Test

Every entry in `findings` has a matching entry in `fixes_applied` or a documented reason for deferral; every entry in `fixes_applied` with `test_added: true` has a regression test that fails on the pre-fix code; the project's security linter (when configured) exits zero on the changed scope.
