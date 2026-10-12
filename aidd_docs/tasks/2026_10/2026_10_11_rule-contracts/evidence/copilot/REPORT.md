# Copilot CLI local instruction capture, 2026-10-11

Verdict: publication and explicit retrieval work. Automatic full-body loading after a simple application-file read was not observed. No writer defect or scope enforcement claim follows from that result.

## Environment and reproducibility

The native CLI reports `GitHub Copilot CLI 1.0.83.`. Its `--help` and `help providers` commands completed with exit 0; receipts are in `cli-help-receipts.json`. The extracted 1.0.83 distribution was pinned with `COPILOT_CLI_DIST_DIR` rather than inspecting the historical npm 1.0.57 JavaScript.

Each native session used a new HOME/COPILOT_HOME/XDG profile, an explicit environment whitelist, `COPILOT_OFFLINE=true`, a fake provider key, and an OpenAI-compatible SSE server bound to `127.0.0.1` on a fresh ephemeral port. GitHub tokens and account configuration were not copied. Built-in MCPs, automatic login, remote export, and auto-update were disabled. The server returned fixed tool calls and final text; there was no real model inference. The observed provider path was exclusively `/v1/chat/completions`. This is configuration and request-capture evidence, not an operating-system packet trace.

The fixture and the complete installed rule skill were copied physically. The copied writer SHA256 is `70783e579b75b9e22760239cbfd4309641bdd73840b17e7dfd606a252679a420`. The installed script created, updated and deleted three rules: global `applyTo: "**"`, domain `src/domain/**/*.ts`, and documentation `docs/**/*.md`. Every writer invocation returned exit 0. Only this temporary probe tree was written.

Reproduce with absolute paths appropriate to the machine:

```sh
python3 probe.py --repo /path/to/framework --binary /path/to/copilot --node /path/to/node --dist /path/to/extracted/copilot/1.0.83 --output /tmp/aidd-oct11-copilot-new-baseline
python3 probe.py --repo /path/to/framework --binary /path/to/copilot --node /path/to/node --dist /path/to/extracted/copilot/1.0.83 --output /tmp/aidd-oct11-copilot-new-indexed --read-indexed
```

Use nonexistent output directories. `--dist` is optional on platforms without an extracted-distribution override. Each session is bounded to 55 seconds. The current portable script kills its own process group on timeout and refuses an existing output directory; unused declarations were removed during review. `baseline-probe.py` preserves the exact harness used for the first run; that run had no timeout. The portable script retains the same baseline behavior without `--read-indexed`.

## Actual observations

All 18 native sessions completed with exit 0: nine baseline sessions and nine explicit-retrieval controls. They produced 40 captured HTTP requests. Their complete request bodies, invocations, stdout/stderr and summaries are preserved separately in `evidence/` and `indexed-evidence/`.

Baseline: the fixed simulated model used the actual advertised `view` tool to read an application domain file, a documentation file or an outside HTTP file, then returned final text. Global OLD body appeared exactly once in both create requests; global NEW body appeared exactly once after update, with OLD absent. The domain and documentation bodies were absent from both requests, even after the corresponding application file was read. Four baseline body-presence expectations therefore remain false, preserved in the summaries rather than converted to passes.

The captured CLI index contained these exact rows in create/update, including the outside control:

```text
| src/domain/**/*.ts | '.github/instructions/08-domain-probe.instructions.md' |  |
| docs/**/*.md | '.github/instructions/09-docs-probe.instructions.md' |  |
```

Descriptions are blank because this writer emits only `applyTo` for Copilot. Index presence is discovery evidence, not full-body consumption.

Explicit retrieval: after the fixture read, the simulated model extracted the matching instruction path from that actual index and issued a second real `view`. The next captured model request contained the complete matching native body exactly once. For each domain/docs create control, body counts were `[0, 0, 1]`; update controls contained NEW `[0, 0, 1]` and no OLD. The unrelated scoped body remained absent. The global body remained exactly once throughout. All nine explicit-retrieval controls satisfy their body checks.

After deletion, both generated scoped index entries and every OLD/NEW generated body were absent in all requests. Generated canonical/native files were actually removed. All 18 session projects preserved the original 378-byte AGENTS.md exactly, including its existing memory block. Copilot-only generation did not publish an AGENTS contribution.

`audit.json` records counts and independently computed byte-preservation checks. No credential token pattern was found in the captured request, invocation, summary, stdout/stderr and help artifacts scanned.

## Bounds

This proves global startup consumption, scoped index discovery, explicit native-body retrieval, update freshness and deletion cleanup on Copilot CLI 1.0.83. It does not prove that a real model will naturally choose the indexed file, that a simple `view` causes automatic body attachment, that edit-triggered loading behaves the same as reading, or that path scope is an enforcement boundary. The fixed simulated model did not author rules or change application code. Current documentation describes scopes; these captures identify the observed loading mechanism without extrapolating from historical npm JavaScript.

Official references: [BYOK](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-byok-models), [offline authentication](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli#offline-mode), [CLI instructions](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions).
