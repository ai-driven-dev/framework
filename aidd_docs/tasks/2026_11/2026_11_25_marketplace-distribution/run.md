# Run: Release marketplace distribution

## Run 1

- Head: `b0ab7d085`
- Left: Verify Cursor installation in the team client and the AIDD App's first release-time publication. The public Cursor catalog and refs are available. The owner added the distribution repository to the App installation.

| Task | Validation | Result |
| --- | --- | --- |
| 1.1 | Run the publication script against a temporary bare Git repository, including a failed push, replay, and stale release. | A failed atomic push left no partial refs. Another tool published independently. A replay preserved its version ref and a stale release left the tool branch unchanged. |
| 1.1 | Install from the public `v5.14.0` catalogs in clean Claude Code, Codex, and Copilot CLI profiles. Compare to the release ZIP plugin manifest. | All three installed `aidd-context` 2.11.0. The Cursor release tag and stable branch resolve over Git. |
| 2.1 | Publish three simulated Claude releases with an existing bootstrap legacy ref. Exercise the migration with Claude Code 2.1.331. | The legacy ref served the first two releases and held the second. Real user and project installs updated in place and could switch to the new catalog. The destination ID needed its own settings. |
| 2.1 | Run translation for all four tools with the compatibility catalog and install from the legacy source. | Translation produced all four catalogs. The native Claude Code install through the compatibility source reported `aidd-context@aidd-framework` 2.11.0. |
| 2.1 | Run `pnpm --dir cli test:arch` and the feature commit's pre-commit hook. | All 208 architecture assertions passed after filtering files that cannot contain the member access. The framework content and generated-doc checks passed. |

## Run 2

- Head: `2349f75a5`
- Left: Verify the live App-token run and Cursor installation in the team client.

| Task | Validation | Result |
| --- | --- | --- |
| 2.1 | Register the development catalog at project scope in a clean Claude Code profile and install a fixture checkout version of `aidd-context`. | Claude Code installed version 9.9.9 under `aidd-framework-dev` at project scope. The public and compatibility payloads still serve 2.11.0. |
| 2.1 | Check the install guides and component READMEs against the hosted Claude Code selector. Run the framework content check and workflow YAML validation. | User-facing Claude Code instructions use `@aidd-marketplace`. The checkout instructions use `@aidd-framework-dev`. Both checks passed. |
