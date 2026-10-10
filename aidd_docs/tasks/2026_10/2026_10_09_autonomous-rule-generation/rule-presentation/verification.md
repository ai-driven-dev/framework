# Readable shared rule verification

Status: passed; independent final evidence review approved.

## Candidate and behavior

Writer SHA-256: `70783e579b75b9e22760239cbfd4309641bdd73840b17e7dfd606a252679a420`. [Archived writer](evidence/write-rule.cjs) matches the project source and all ten delivered copies in the fresh sandbox ([installed hashes](evidence/installed-writers.json)).

The added heading uses the description, without category/slug. A body already starting with an ATX or single-line Setext title receives no additional title. Scope becomes `Applies to:` with literal Markdown code spans, or `all files`. For an untitled body:

```markdown
## Domain review

Applies to: `src/domain/**/*.ts`.

- Require the domain review marker.
```

When the body already has a title, scope precedes the complete unchanged body. Existing title levels, examples, Unicode and LF/CRLF bytes are retained. Detection is bounded to leading ATX and single-line Setext syntax, not a general Markdown parser. [CommonMark headings](https://spec.commonmark.org/0.31.2/#setext-headings) and [code spans](https://spec.commonmark.org/0.31.2/#code-spans) were checked against the primary specification; inline HTML and autolinks remain paragraph text, while actual HTML blocks are excluded.

Canonical metadata, native Claude/Cursor/Copilot rendering and ownership checks remain unchanged. Intact earlier signed `aidd_rules` contributions can be republished; edited ones refuse before writes. Legacy `aidd_opencode_rules` is still rejected. The change introduces no CLI code or dependencies.

## Regression evidence

The first eleven new tests failed on the prior writer for the expected visible format assertions. Independent review then found overly broad Setext exclusions. Three additional witnesses failed before repair: hash without an ATX separator, inline HTML and autolinks. The repaired tests distinguish those titles from HTML blocks, standalone tags, comments, ordered lists, fenced examples and indented code.

The final wrapped repository run passed **613 tests, zero failures or skips**, including **59 rule-generation tests**. [Complete test log](evidence/root-tests.log). The tests execute copied installed scripts with empty PATH inside ES module projects. They verify complete-body preservation, backticks in scopes, full snapshots after repeat publication, replacement of old bodies, exact last-deletion restoration, and refusal without mutation. The older signed-format witness additionally checks that every canonical/native file remains byte-identical during presentation-only republication.

```sh
node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'
```

## Fresh realistic sandbox

[Reproduction results](evidence/sandbox/reproduction-results.json) cover six separate projects: Claude, Cursor, Copilot, Codex, OpenCode and their combination. Real CLI installation/translation delivered ten copies of the current script. This proves distribution and script execution; flat translation alone does not prove native skill activation.

[Lifecycle results](evidence/sandbox/lifecycle-results.json): **78 installed-script operations**, repeat publication with identical bytes, exact preservation of user native files and project-memory content, and exact restoration of the original AGENTS.md after last deletion. **54 application tests** pass across the six invoice/API projects, in addition to the nine initial baseline tests.

[Twelve negative cases](evidence/sandbox/negative-results.json) all refused with complete project bytes unchanged: edited native output, duplicate/incomplete shared contribution, symlink targets/sources, Codex override/size limit, malformed JSON, invalid UTF-8, lone surrogate, edited separator and unsafe canonical publication.

[Cleanup evidence](evidence/sandbox/cleanup-results.json): five CLI doctor/sync/remove commands exit zero, the managed plugin script is removed, and generated rules plus application/user files survive. These checks concern CLI compatibility; rule generation itself executes the skill script without requiring the CLI.

```sh
node aidd_docs/tasks/2026_10/2026_10_09_autonomous-rule-generation/realistic-sandbox/reproduction/run.cjs --repo "$PWD"
```

## Actual host input, local model only

Real Codex and OpenCode V2 binaries exercised creation, update and deletion against fresh controlled projects. The isolated profiles used loopback mock providers with fixed replies, no copied authentication and no paid inference. [Runtime checks](evidence/runtime-checks.json) and the request/summary files indexed in [evidence index](evidence/index.json) preserve the actual HTTP payloads.

All six journeys exit zero. After creation/update, the complete current body reaches a request once, the scope is present and the technical heading is absent. Update omits the old marker. Deletion omits both markers and scope and restores exact original user bytes. Codex makes one request per journey; OpenCode makes two, with the rule in its second request after creation/update and in neither request after deletion. The preliminary OpenCode request contains no rule body.

These captures prove host input loading, not semantic enforcement by a subscription model. Earlier paid-subscription native receipts remain historical at writer `9fa10479…`, including the documented incomplete Cursor quota-limited control. They are not presented as new-model tests of this candidate. No further subscription-model call, purchase or overage was made.

## Final boundaries

For the same canonical content, targets and starting project bytes, publication produces identical file bytes. The agent's authorship of rule content is not itself deterministic. In-file scope remains guidance for the Codex/OpenCode model, rather than a native file-selection filter. The existing local Codex budget and per-file atomicity limits still apply; concurrent writers and multi-file disk failure rollback remain outside the contract.

The [ten repository gates](evidence/repository-gates.json) all passed: context, reference form, referenced paths, Markdown links, argument hints, document duplication, architecture, whitespace, unchanged CLI and validation of 24 JSON evidence files. Independent [final review](review.md) approved five of five criteria, verified all 42 evidence hashes and closed the Setext finding. Validation completed without a commit or push; publication was subsequently authorized by the user.
