---
status: pending
---

# Instruction: Simplify the runtime and workflows

## Architecture projection

```txt
.
├── .github/
│   └── workflows/
│       ├── opencode-review.yml ✏️
│       ├── opencode.yml ✏️
│       └── validate.yml ✏️
├── docker/
│   └── aidd-opencode/
│       ├── Dockerfile ✏️
│       ├── review-prompt.txt ✏️
│       └── runner/
│           ├── Dockerfile ✏️
│           ├── Dockerfile.dockerignore ✏️
│           ├── dispatch.sh ✏️
│           ├── policy.json ✏️
│           ├── run-review.sh ✏️
│           └── runner.sh ✏️
└── scripts/
    └── pr-review/
        ├── discover.sh ✅
        ├── conversation-prompt.sh ✅
        ├── model.sh ✏️
        ├── review.sh ✏️
        ├── test-review.sh ✏️
        ├── test-conversation.sh ❌
        └── test-model.sh ❌
```

Delete an existing runtime component instead of modifying it if it becomes unnecessary; do not retain an image, wrapper, or trace check solely because it already exists.

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Prepare temporary projects with and without a manifest. | The CLI and plugin choices are visible. | cli |
| Happy path | Review a PR using Git and `gh`. | OpenCode sees the diff and discussion and a response reaches the PR conversation. | cli |
| Edge case | Repeat a submission or make GitHub unavailable. | Unchanged files are skipped; a failure is reported without claiming success. | cli |
| Teardown | Remove temporary projects and local smoke scripts. | No disposable test script is committed. | system |

## Tasks to do

### `1)` Install the project runtime with `npx`

> Address [project installation](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487456681), [OpenCode focus](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487458728), and [skill access](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487466671).

1. Read `.aidd/manifest.json` when present and select the recorded project tool's CLI version. Use the OpenCode entry when available; do not mistake the top-level schema `version` for a CLI version. If a present manifest does not identify an unambiguous version, report that fact. When the manifest does not exist, use `@latest` as requested.
2. Use `npx` to install the project's recorded plugins from their available sources in a temporary directory, then expose that installation to OpenCode while it reads the separate Git checkout. For the default AIDD marketplace, the verified command is `npx --yes @ai-driven-dev/cli@<version> setup --source remote --ai opencode --plugins <names> --yes`. For other marketplaces or local plugins, use their recorded sources when available; report any missing plugin rather than silently omitting it. Without an inventory, the CLI's non-interactive default installs no plugins; report that the list was unavailable. Do not treat the absence of a manifest as proof that the original project has no installation.
3. The CLI version and remote marketplace release are distinct: `--source remote` selects the current catalog unless a release is supplied. Report any plugin version difference; do not claim an exact restoration without checking it. Provide the existing read-only GitHub token to setup as `AIDD_TOKEN` when needed, including when the unauthenticated GitHub quota is exhausted. Never expose `.aidd/auth.json` or print the token.

### `2)` Review the repository and answer the PR

> Address [reviewer prompt](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487478874) and [model script clarity](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487490485).

1. Give OpenCode access to the repository and the submitted commit's diff with `git diff`; fetch enough history for the correct base. Make the PR conversation available with `gh pr view --comments` and inline review comments with `gh api --paginate repos/<owner>/<repo>/pulls/<number>/comments`.
2. Ask for a reviewer to inspect the code and answer. Use an available OpenCode subagent when the project supplies no reviewer; do not name a particular implementation in the prompt, force skill calls, or block installed skills. Use a trusted OpenCode policy to allow the needed Git and `gh` reads while preventing execution of PR-controlled scripts with credentials; do not rely on the prompt alone.
3. Give the reviewer a repository-scoped read token for `gh`. Keep the existing write token in the trusted workflow, which publishes the answer with `gh pr comment` in the PR conversation or the review-comment reply endpoint for an inline thread. Do not run untrusted PR scripts with credentials or expose tokens in logs.
4. Preserve review of the submitted commit and skipping previously reviewed unchanged files. Keep failure and publication behavior honest, without retaining extra batch or trace machinery unless it protects a concrete requirement.

### `3)` Extract the workflow scripts

> Address [scheduled workflow](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487413205) and [conversation workflow](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487446466).

1. Move the long workflow shell blocks into the scripts above. Execute the conversation script from the trusted default-branch checkout, not the PR checkout with access to `GH_TOKEN`.
2. Add a short purpose comment at the top of each retained or new shell script. After local verification, delete the disposable [conversation test](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487491271) and [model test](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487493416), and remove their CI invocations.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | The existing manifest selects its project CLI version and listed plugins; inaccessible plugin sources are reported. A missing manifest invokes `@latest` and does not invent a plugin inventory. Setup leaves the Git checkout unchanged. |
| 2 | The reviewer can inspect the submitted diff and PR conversation and call installed skills; the trusted workflow publishes its `gh` reply without giving it the write token. Unchanged files are skipped and failures remain visible. |
| 3 | Both workflows invoke trusted external scripts, retained shell scripts state their purpose, and the two disposable tests are absent from the tree and CI. |
