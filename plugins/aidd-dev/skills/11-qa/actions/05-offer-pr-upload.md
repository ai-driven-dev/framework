# 05 - Offer Pull Request Upload

Offer to add the main QA video to an existing pull request.

## Input

The saved QA report, the happy-path WebM file, and the current branch.

## Output

An updated pull request body after approval and a supported attachment capability, or a reported QA evidence path and status.

## Process

1. **Detect.** Resolve whether the current branch already has an open pull request through the project's configured VCS read capability.
2. **Report.** When no pull request exists, report both `qa.md` and `qa/happy-path.webm`. Stop without an external update.
3. **Offer.** When a pull request exists, show `qa/happy-path.webm` and ask the user to approve the update.
4. **Attach.** After approval, use a configured VCS UI capability that can attach local files. Add the resulting video URL to the pull request body without removing its existing content.
5. **Block.** When no attachment-capable VCS UI is available, report `blocked: attachment-capability-unavailable`. Never claim the video was uploaded.
6. **Confirm.** Verify the pull request body contains the uploaded video URL. Record its URL in `qa.md`.

## Test

- Without a pull request, no external update occurs and the qa.md and main WebM paths are reported.
- With a pull request, user approval, and an attachment-capable VCS UI, the body contains the video URL.
- Without an attachment-capable VCS UI, the action reports `blocked: attachment-capability-unavailable` and does not claim success.
