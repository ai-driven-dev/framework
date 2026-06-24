# 02 - Security

Find and fix security vulnerabilities, then add test coverage and documentation for the fixes. A security fix may change observable behavior to close a hole, which must be called out explicitly.

## Input

An optional scope, a directory or file glob, defaulting to the entire codebase. Optionally a pushed audit report, a path under `aidd_docs/tasks/audits/` or pasted findings.

## Output

The vulnerabilities found and the fixes applied (file, one-line summary, whether behavior changed, whether a test was added).

## Process

1. **Source.** When an audit report is pushed, take its security-axis findings as the fix list and skip to Apply. Otherwise scan the scope with static analysis where available and a manual pass against the OWASP Top 10.
2. **Inputs.** Check input validation at every external boundary (HTTP handlers, CLI args, file parsers, IPC).
3. **Access.** Review authentication and authorization paths, flagging missing checks and broken role propagation.
4. **Injection.** Identify injection risks (SQL, command, template, XSS, SSRF).
5. **Apply.** Fix with secure functions, least privilege, and parameterized APIs over ad-hoc sanitization. When a fix changes observable behavior, mark it and explain the change inline.
6. **Cover.** Add a regression test, unit or integration, for each fix.
7. **Document.** Record the security measures added or changed (doc strings, ADRs, or `aidd_docs/memory/` entries) so a later refactor does not regress them.

## Test

- Every finding has a matching fix or a documented reason for deferral.
- Each fix with a test added has a regression test that fails on the pre-fix code.
- The project's security linter, when configured, exits zero on the changed scope.
