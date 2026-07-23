# Playwright CLI runner

Run browser QA through the Playwright Agent CLI. It produces human-viewable WebM recordings without adding a test dependency to the application.

## Invocation

Use the exact package version supplied to the QA run. The current framework pin is `0.1.17`.

```bash
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id> <command>
```

Record the package version and the full command prefix in the QA result. Upgrade the pin deliberately with the framework, never by using `latest` during a QA run.

## Browser provisioning

The CLI downloads Chromium when it first needs a browser. Prewarm it when a local machine or CI job must avoid that delay.

```bash
npx --yes @playwright/cli@0.1.17 install-browser
```

On Linux, add `--with-deps` when the environment lacks Chromium system dependencies. Browser binaries live outside the application repository.

## Recording contract

Use one named session per QA run. It prevents concurrent QA runs from sharing browser state.

```bash
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id> video-start happy-path.webm --size=800x600
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id> video-chapter "<happy-path step>"
# Drive the scenario with the same session.
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id> video-stop
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id> close
```

`video-stop` writes the file under `.playwright-cli/` in the current directory. Action `save-evidence` moves the retained WebM files into the feature's `qa/` directory. Use a separate recording for each requested edge case. Add chapters only for meaningful user-visible milestones.
