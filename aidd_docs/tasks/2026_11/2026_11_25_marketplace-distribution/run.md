# Run: Release marketplace distribution

## Run 1

- Head: `b0ab7d085`
- Left: Verify Cursor installation in the team client and the AIDD App's first release-time publication. The public Cursor catalog and refs are available. The owner added the distribution repository to the App installation.

| Task | Validation | Result |
| --- | --- | --- |
| 1.1 | Run the publication script against a temporary bare Git repository, including a failed push, replay, and stale release. | A failed atomic push left no partial refs. Another tool published independently. A replay preserved its version ref and a stale release left the tool branch unchanged. |
| 1.1 | Install from the public `v5.14.0` catalogs in clean Claude Code, Codex, and Copilot CLI profiles. Compare to the release ZIP plugin manifest. | All three installed `aidd-context` 2.11.0. The Cursor release tag and stable branch resolve over Git. |
| 2.1 | Run `pnpm --dir cli test:arch` and the feature commit's pre-commit hook. | All 208 architecture assertions passed after filtering files that cannot contain the member access. The framework content and generated-doc checks passed. |

## Run 2

- Head: `2349f75a5`
- Left: Verify the live App-token run and Cursor installation in the team client.

| Task | Validation | Result |
| --- | --- | --- |
| 1.1 | Check the public tool branch and version refs after the review fixes. | `git ls-remote` resolves the four tool branches and their `v5.14.0` tags. |

## Run 3

- Left: Verify a release-time publication with the App token. The `claude-legacy` branch and the compatibility catalog are not part of the shipped design: Cursor is not published, and the hosted catalogs carry only the distribution name.

| Task | Validation | Result |
| --- | --- | --- |
| 1.1 | Run the marketplace tools, publication, verification and generated-docs tests under `node --test`. | All 27 passed. `notHosted` is a list of ids, not a filter: the coverage tests fail when it names a published tool or omits an unpublished one. |

## Run 4

- Left: A release-time publication, which renames the Copilot and Codex catalogs to the distribution name.

| Task | Validation | Result |
| --- | --- | --- |
| 1.1 | Run the dry-run workflow on the pull request. | Run 45887022291 succeeded. |
| 1.1 | Dispatch the App reach check against the distribution repository. | Run 45888997513 succeeded: the token reached the repository. |
| 1.1 | List the distribution repository refs. | The `cursor` branch and tag are deleted: Cursor is not published. Claude Code serves `aidd-marketplace`; Copilot and Codex still serve `aidd-framework`. |
