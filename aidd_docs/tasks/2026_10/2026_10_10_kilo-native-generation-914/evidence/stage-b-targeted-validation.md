# Targeted AC13–14 validation

Validation on 2026-10-14 (Europe/Paris), working tree based on `b9b31cd48efdb0d6c40279f49357a7c44a29a4ac`. These checks ran the installed skill copies through Codex CLI 0.162.1 in isolated temporary projects. They did not run a Kilo host or an authenticated Claude session.

## Behavioral cases

Each case was run with `node scripts/skill-eval.mjs aidd-context --host=codex --case='<name>' --judge --keep`. The final run of every listed case returned `PASS`, with zero `INCOMPLETE` results. `--keep` retained the temporary projects for local inspection; the hashes below preserve the relevant file observations in this report.

| Case name | Final result | Decisive observation |
| --- | --- | --- |
| Kilo native skill uses one canonical tree | PASS | Native files exist, portable duplicate absent; harness second pass preserved project bytes and mtimes. |
| existing exact AIDD entry and user duplicates remain unchanged | PASS | Kilo hook file absent; existing Claude config, script and Kilo config unchanged; judge passed. |
| Kilo agent rerun preserves its destination and user files | PASS | One native agent, no legacy or Claude copy; user files unchanged; harness second pass preserved project bytes and mtimes. |
| Kilo workflow rerun preserves its destination and user files | PASS | One native command, no legacy or Claude copy; user files unchanged; harness second pass preserved project bytes and mtimes. |
| unsafe late Kilo target leaves earlier Claude target absent | PASS | Existing unsafe target unchanged; earlier Claude skill absent; judge passed. |
| last Kilo agent collision refuses before Claude write | PASS | User agent unchanged; earlier Claude agent absent; judge passed. |
| last Kilo workflow collision refuses before Claude write | PASS | User workflow unchanged; earlier Claude command absent; judge passed. |
| invalid final mixed target stops before prior writes | PASS | Invalid Copilot config and Kilo config unchanged; Claude config/script and Kilo hook absent; judge passed. |

The initial run of the workflow collision case returned `FAIL` only on its LLM judge: the judge required a verbal assertion that the user file was unchanged, while the deterministic check had already verified unchanged bytes. The case's judge criterion was narrowed to the reported collision and absent Claude command. Its rerun passed, including the unchanged-file checks. A further rerun passed deterministic checks for refusal wording and an unchanged complete project tree, including the absence of any new output. No generator contract was changed for this result.

## Retained snapshot checks

For each refused operation, the listed fixture files were read back from the retained temporary project and compared byte-for-byte with the case setup. Every expected absent output was checked again. The SHA-256 value identifies the serialized setup file map used for that comparison.

| Refused case | Setup files unchanged | Outputs absent | Setup SHA-256 |
| --- | ---: | ---: | --- |
| Unsafe late Kilo skill target | 2 | 1 | `b5dc1feeb9c64682f63a93fc6c3b73357398f6e95716141db43dd69f9451a860` |
| Last Kilo agent collision | 2 | 1 | `990da88a55c4256e14e3dd7937cb6527606348aab73464521728d88afb8e4355` |
| Last Kilo workflow collision | 2 | 1 | `539224bda200f5ab6ded345b8dd8f763a1b02fedf2355929d443c7a71ec320e7` |
| Invalid final mixed hook target | 2 | 3 | `db33b07d146390598b47474957f6110deac6c575ab04d9ec09cfcb99eb5f88d7` |

Generated destination snapshots after successful reruns:

| Destination | SHA-256 |
| --- | --- |
| `.kilo/skills/verify-payload/SKILL.md` | `cb6a884833dd64bcd4a16721f1e489c8662482ba7a475036e125473951cd4b24` |
| `.kilo/agents/verify-agent.md` | `b46a74c4f8b6c17c2e2cb3ee402a5f7186d8fa669fc3390620955c482bb37b68` |
| `.kilo/commands/verify-workflow.md` | `b992cf47b3e49d9bbe942bffc871147b41dd8510225a2cecd9470db2c6e8bc71` |
| Unchanged `.claude/settings.json` for the exact hook entry | `27d5116e163fe8763f721705554fc808d2986cedca6de33643af70cc3f29a8c0` |

## Contract and publication checks

- `node --test` on the seven targeted detection, artifact, hook, rule, memory and portability suites: 162 passed, 0 failed, 0 skipped.
- `node scripts/check-markdown-links.js`: 0 broken links in 951 files.
- `git diff --check`: passed.

The contract tests verify available instructions and fixtures, not universal LLM compliance. The automatic memory hook intentionally remains best-effort and is outside the explicit-sync preflight guarantee. An I/O error after an authorized write starts remains tracked in #1018.
