# Run: Native generator options

## Run 1

- Head: `7839784e2`
- Left: Native runtime behavior was exercised in Kilo with a local model stub. Other targets have generated-file coverage. The Claude plugin validator passed with warnings from existing manifest and hook settings.

| Task | Validation | Result |
| --- | --- | --- |
| 1.1 | `node --test scripts/__tests__/agent-generation.test.js scripts/__tests__/command-generation.test.js` | Native values retain their format and target, including all four requested Kilo fields. |
| 1.2 | `node --test scripts/__tests__/check/command-contract.test.js` and Kilo server commands and agents endpoints | A generated Kilo command passes the installed validator. Kilo loaded the four fields, dispatched one child session and denied an edit that succeeded in the control agent. |
| 2.1 | `node --test scripts/__tests__/scaffold-skill.test.js` | Nine targets covered. Shared paths write once for equal inputs. Conflicts, preview and read-only destinations leave all files intact. |
| 2.2 | `node --test scripts/__tests__/hook-generation.test.js` | Typed native options stay within the owned handler. The existing OpenCode and Kilo module path still works. |
| 3.1 | `node --test scripts/__tests__/rule-generation.test.js scripts/__tests__/check/rule-contract.test.js` and `kilo debug config` in a disposable project | Native options survive republication. Kilo read the preserved JSONC instructions in order and resolved the canonical rule. |
| 3.2 | `node --test scripts/__tests__/generator-hosts.test.js` and actual Kilo writers in a disposable legacy project | Seven workflow references recognize the legacy marker, and generated files land under the canonical directory. |
| 3.3 | `node scripts/check/engine/sync.cjs --check`, `node scripts/check/run.cjs`, wrapped scripts suite and contributor gate | Synced contracts and generated outputs pass repository checks. The isolated installed fixtures cover the writers without relying on the development checkout at runtime. |
