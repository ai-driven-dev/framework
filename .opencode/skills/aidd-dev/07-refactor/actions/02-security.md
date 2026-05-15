# 02 - Security

Identify and fix security vulnerabilities, then strengthen the codebase by adding test coverage and documentation for the fixes.

## Inputs

```yaml
scope: <directory or file glob>   # optional; defaults to the entire codebase
focus_areas:
  - input_validation
  - authentication_authorization
  - injection
  - secrets_handling
  - dependency_versions
```

## Outputs

```yaml
findings:
  - { id: <CWE or OWASP category>, file: <path>, severity: critical|high|medium|low, summary: <one-line> }
fixes_applied:
  - { id: <id>, file: <path>, change: <one-line summary>, test_added: true|false }
deps_updated:
  - { package: <name>, from: <ver>, to: <ver>, reason: <CVE id or rationale> }
```

## Process

1. **Scan the scope** for vulnerabilities using static analysis where available, and a manual pass against OWASP Top 10.
2. **Check input validation** at every external boundary (HTTP handlers, CLI args, file parsers, IPC).
3. **Review authentication and authorization** paths; flag missing checks and broken role propagation.
4. **Identify injection risks** (SQL, command, template, XSS, SSRF).
5. **Apply fixes**, preferring secure functions, least privilege, and parameterized APIs over ad-hoc sanitization.
6. **Add security test coverage** for each fix (regression unit or integration tests).
7. **Update vulnerable dependencies** to the nearest non-vulnerable version; record each bump.
8. **Document the security measures** added or changed (inline doc strings, ADRs, or `aidd_docs/memory/` entries) so they are not regressed by future refactors.

## Test

Every entry in `findings` has a matching entry in `fixes_applied` or a documented reason for deferral; every entry in `fixes_applied` with `test_added: true` has a regression test that fails on the pre-fix code; the project's security linter (when configured) exits zero on the changed scope.
