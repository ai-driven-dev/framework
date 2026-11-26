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

- Left: Verify Cursor installation in the team client, the live App-token run and a green run of the dry-run workflow. The `claude-legacy` branch and the compatibility catalog are not part of the shipped design: Cursor is not published, and the hosted catalogs carry only the distribution name.

| Task | Validation | Result |
| --- | --- | --- |
| 1.1 | Run the marketplace tools, publication, verification and generated-docs tests under `node --test`. | All 28 passed. Removing the `notHosted` exclusion turned the Cursor publishability test red. |
