# Publish QA evidence

- Publish the report, tested commit when known, and videos to the PR or MR; never commit videos.
- Keep the report and videos in a temporary directory outside the repository until publication is verified.
- Identify the video for each scenario in the report; remove local file links from the published comment.

## GitHub

- Check that `gh pr comment` supports `--attach` and that the account can upload.
- Use `gh pr comment <PR-URL> --body-file <report> --attach <video>`, repeating `--attach` per video.
- Put `![](<video-path>)` alone in its own Markdown paragraph under the scenario name outside the table; the CLI replaces it with the uploaded URL.
- Source: https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli

## GitLab

- Upload each video with `POST /projects/:id/uploads`; insert the returned Markdown references beside their scenarios.
- Post the report with `POST /projects/:id/merge_requests/:iid/notes`.
- Sources: https://docs.gitlab.com/api/project_markdown_uploads/ and https://docs.gitlab.com/api/notes/#create-a-merge-request-note

## Bitbucket Cloud

- Direct video attachment to a PR comment is unverified.
- If repository Downloads storage is acceptable, upload each video with a unique run-specific name via `POST /2.0/repositories/{workspace}/{repo_slug}/downloads`; link it in a PR comment via `POST /2.0/repositories/{workspace}/{repo_slug}/pullrequests/{id}/comments`.
- Downloads belong to the repository, not the PR. Do not use this alternative without confirming its storage is acceptable.
- Sources: https://support.atlassian.com/bitbucket-cloud/docs/deploy-build-artifacts-to-bitbucket-downloads/ and https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/

## Completion

- Read the published comment and verify each video is accessible before deleting local files.
- Without a PR or MR, retain the files and report publication as pending; on failure or an unsupported platform, retain them and report publication as blocked.
- Inspect partial publication before retrying to avoid duplicate comments or uploads. Report publication separately from the QA verdict.
