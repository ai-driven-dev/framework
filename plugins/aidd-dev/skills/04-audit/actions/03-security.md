# 03 - Security audit

Read-only audit of the `security` pillar: OWASP top risks and code-level security weaknesses. Reports findings, never edits code.

## Inputs

```yaml
scope: <directory or file glob>    # optional; defaults to the entire codebase
```

## Outputs

```yaml
audit_path: aidd_docs/tasks/audits/<yyyy>_<mm>_security.md   # or <yyyy>_<mm>_full.md in a full run
pillar: security
findings_count: <int>
```

## Process

1. **Load scope.** Default to the full codebase when `scope` is absent; otherwise restrict scanning to the provided glob or directory.
2. **Scan the security lens** below using static code analysis. Stay in this pillar - known-CVE and vulnerable-dependency findings belong to `04-dependencies`; architecture coupling to `02-architecture`.
   - **Input validation at trust boundaries**: check that all external inputs (HTTP requests, env vars, file paths, user-supplied data) are validated or sanitised before use.
   - **Authn/authz gates**: verify that authentication and authorisation checks are enforced consistently at every protected route or operation.
   - **Secrets committed in code**: flag hardcoded credentials, API keys, tokens, or passwords anywhere in the scanned files.
   - **Injection risks**: SQL, command, XSS, LDAP, template injection - identify concatenated or unescaped values passed to interpreters.
   - **Unsafe deserialization**: flag use of `eval`, unsafe YAML/pickle/JSON reviver patterns, or object deserialization from untrusted sources.
   - **Insecure defaults**: missing TLS enforcement, overly permissive CORS, disabled security headers, debug flags left on in non-dev code.
   - Use static analysis tools when available; flag only findings supported by code evidence. Do not infer from naming alone.
3. **Rate each finding.** Severity (🔴 / 🟡 / 🟢) and effort (S/M/L) per `@../assets/audit-template.md` legend. Quote a concrete `file:line` for every finding. Category is always `security`.
4. **Write the report** using `@../assets/audit-template.md`: fill the Findings table (one row per issue, severity-first), ranked Top actions (hand off fixes to `aidd-dev:07:refactor` for security), and the Coverage section. In a full audit run, contribute these finding rows to the single merged report per the skill output contract instead of writing a separate file. Read-only: emit the report and stop; do not edit code.

## Test

The output file exists at `audit_path`; it has the `## Findings`, `## Top actions`, `## Coverage` sections; every Findings row has a severity, category `security`, a concrete `file:line`, and an effort; Coverage lists `security` as scanned. No abstract "the codebase has..." sentences, no code changes made.
