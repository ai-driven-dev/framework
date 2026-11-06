---
status: pending
---

# Instruction: Verify and document

## Architecture projection

```txt
.
├── .github/
│   └── workflows/
│       ├── opencode.yml ✏️
│       └── validate.yml ✏️
├── aidd_docs/
│   └── tasks/
│       └── 2026_11/
│           └── 2026_11_05_opencode_pr_review/
│               └── proof.md ✏️
├── docker/
│   └── aidd-opencode/
│       ├── README.md ✏️
│       └── runner/
│           └── README.md ✏️
└── scripts/
    └── pr-review/
        └── test-review.sh ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Use temporary project manifests, dummy credentials, and a controlled PR fixture. | The test cannot alter a production PR. | system |
| Happy path | Exercise version selection, plugin setup, Git diff, PR conversation, and reply. | The chosen version, context, and reply match the request. | cli |
| Edge case | Omit the manifest, repeat an unchanged review, or fail a GitHub request. | `latest` is used, unchanged files are skipped, and errors remain visible. | cli |
| Teardown | Remove local fixtures and temporary tests. | No one-off test script remains in the commit. | system |

## Tasks to do

### `1)` Verify the smallest usable runner and release

> Address [OpenCode runner](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487443027), [validation runner](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487461139), and [latest OpenCode](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487471702).

1. Use `ubuntu-slim` where the simplified job can run safely within its limits. If Docker remains necessary, retain a compatible runner; do not add an image just to retain the old structure.
2. Check the current stable OpenCode release at implementation time and use it consistently. On 2026-11-06, the npm `latest` was already `2.2.5`.

### `2)` Run focused checks and simplify documentation

> Address [runner TLDR](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487469050) and [documentation duplication](https://github.com/ai-driven-dev/framework/pull/1150#discussion_r4487472888).

1. Locally verify the manifest and `latest` paths, recorded plugin names, a clean checkout after setup, submitted Git diff, full PR discussion including inline comments, `gh` reply, unchanged-file skipping, and an error path. With synthetic credentials and PR content, verify the reviewer cannot access the write token or execute PR scripts with credentials. Keep only necessary behavior checks; do not commit disposable model or conversation tests.
2. Run `make check`; run `pnpm exec lefthook run pre-push` before any push. Record what was actually tested, including whether a real model or GitHub runner was used.
3. Put a TLDR at the start of the runner README, keep setup instructions in one place, and update `proof.md` without duplicating the README.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Each job uses the smallest runner that supports its actual needs; the selected OpenCode version is checked against the current stable release. |
| 2 | Focused checks and applicable gates pass, or their exact failures are recorded; documentation describes the result once and states any unverified live behavior. |
