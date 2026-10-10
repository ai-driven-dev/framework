# Native Codex rule journey

Codex CLI 0.160.1 executed seven separate native conversations against `projects/model-codex`. Each used the existing ChatGPT subscription; local preflight confirmed ChatGPT authentication and no API key. The process inherited only a whitelist of non-secret environment values, ignored user configuration and execution-policy rules, selected the native OpenAI provider explicitly, and used workspace-write sandboxing. No endpoint or mock provider was substituted. No purchase, API fallback or paid overage was requested. The private 0600 authentication copy was removed after the run; it is not evidence to copy into a report.

Before authoring, only the two corrected installed Markdown documents were refreshed from the approved candidate. The installed script stayed SHA-256 `9fa10479a267d899a6a024f68e75573f1d009080cd60851f23f06c8f2d190591`.

The author prompt named the installed skill and described scope and desired behavior, confirming capture choices. It provided neither the writer script path nor a JSON request. `01-author/events.jsonl` records native discovery of the installed skill, references/actions and writer invocation. Each stage has prompt, exact command, JSONL events with tool calls, final response, AGENTS before/after, canonical before/after, source/docs snapshots and application test output. These are CLI/tool traces and instruction-file evidence; no private HTTP request or hidden system message is claimed captured.

Observed stages:

1. Natural author created `aidd_docs/rules/02-programming-languages/2-domain-export-review.md`, targeting Codex and `src/domain/**/*.ts`, requiring `Team reviewed domain change`. The body appeared in the signed AGENTS contribution.
2. Fresh conversation added `normalizeCustomerId` with `// Team reviewed domain change` immediately above its exported declaration.
3. Fresh conversation created `docs/invoice-examples.md`; it contains neither declaration-review comment.
4. Natural skill update replaced the requirement with `Domain validation reviewed`; AGENTS contains the new phrase and no old phrase.
5. Fresh conversation added `isSupportedCurrency` with `// Domain validation reviewed` immediately above its exported declaration.
6. Natural skill deletion removed the canonical rule and shared contribution.
7. Fresh post-deletion conversation added `isInvoiceId`; it has neither review comment.

All seven CLI exits and application retests were zero, all seven thread IDs differed, and no conversation reached the 180-second timeout. AGENTS after deletion exactly equals the original bytes. Existing Claude/Cursor/Copilot user-rule hashes and the real memory file hash are unchanged. `observations.json` records these comparisons. `summary.json` records durations, events and per-conversation native usage. Reported aggregate usage is 801065 input tokens, of which 700032 cached, and 7209 output tokens; these cumulative tool-turn counters are not an API billing measurement.

The author created staging files under `/private/tmp/harbor-rule-validation`, a scratch path chosen by the native agent despite the isolated TMPDIR. The test harness did not erase that path or assume exclusive ownership. Application/project writes and evidence were confined to the assigned Codex clone/evidence area; framework sources, other model clones and global user settings were untouched by the harness.

These observations apply to the exercised Codex version, subscription-backed native provider and macOS execution. They do not establish runtime behavior for other hosts or platforms.
