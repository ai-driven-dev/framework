# Playwright CLI runner

Run browser QA through the Playwright Agent CLI. It produces human-viewable WebM recordings without adding a test dependency to the application.

## Invocation

Use the framework pin below. The current version is `0.1.17`.

```bash
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id> <command>
```

Upgrade the pin deliberately with the framework, never by using `latest` during a QA run.

## Recording contract

Use one named session and one raw WebM per scenario. Fix the browser viewport and recording frame at `1280×720`. Reach the prepared initial state before `video-start`; stop immediately after the observable result.

```bash
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id>-<scenario-slug> resize 1280 720
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id>-<scenario-slug> video-start raw-<evidence-name>.webm --size=1280x720
# Drive the scenario with the same session.
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id>-<scenario-slug> video-stop
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id>-<scenario-slug> close
```

`video-stop` writes under `.playwright-cli/` in the current directory. Use `raw-happy-path.webm` and `raw-edge-case-<scenario-slug>.webm`.

## Duration gate

Inspect every raw take in one call.

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height:format=duration \
  -of json raw-<evidence-name>.webm
```

When `ffmpeg` is unavailable, only an already-short raw take can pass. A take above 12 seconds reports `blocked: media-postprocess-unavailable`.

Trim known dead time first. Re-encode without audio.

```bash
ffmpeg -y -ss <start-seconds> -to <end-seconds> -i raw-<evidence-name>.webm \
  -an -vf "fps=12,scale=1280:-2:force_original_aspect_ratio=decrease" \
  -c:v libvpx-vp9 -crf 36 -b:v 0 <evidence-name>.webm
```

When the meaningful segment still exceeds 12 seconds, set `<speed-factor>` to `duration / 12` and accelerate it.

```bash
ffmpeg -y -i raw-<evidence-name>.webm \
  -an -vf "setpts=PTS/<speed-factor>,fps=12,scale=1280:-2:force_original_aspect_ratio=decrease" \
  -c:v libvpx-vp9 -crf 36 -b:v 0 <evidence-name>.webm
```

Inspect the final file with the same `ffprobe` command. Require codec `vp9`, width `1280`, and duration at most 12 seconds. Never keep invalid reviewer evidence.

Remove raw takes only after every final WebM passes the duration gate.
