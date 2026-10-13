# Browser recorder

## Invocation

Run outside the application repository in a temporary directory; never `latest` or an application dependency:

```bash
npx --yes @playwright/cli@0.1.17 -s=demo-<run-id>-<journey-slug> <command>
```

Keep stdout, stderr and exit status visible: no redirects, pipes, command substitutions or `|| true`.

## Recording

One named session and raw WebM per journey; viewport/frame `1280×720`. Final: `<journey-slug>.webm` (`<evidence-name>` below).

1. `resize 1280 720`; reach initial state before `video-start raw-<journey-slug>.webm --size=1280x720`.
2. One `run-code 'async page => { ... }'` contains every interaction; never separate click/fill/scroll commands. Hold initial and verified final states `1000 ms`; pause `300 ms` between actions and after scrolls.
3. Bound each expectation with `waitFor`; return `{ step, expected, actual, ok }` per step. Mismatches never throw. Throw, `SyntaxError`, or non-zero exit invalidates take.
4. `video-stop` only after `run-code` succeeds; raw file lands in current directory. Teardown before `close`.

## Duration

Probe raw once and final after encoding:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height:format=duration \
  -of json <input.webm>
```

Maximum 12 seconds, never a target: no padding/extension/acceleration. Above cap, remove non-journey actions and re-record; required journey cannot fit => `blocked`.

Without `ffmpeg`, only already-short raw passes; otherwise `blocked: media-postprocess-unavailable`.

Never trim head or infer first action from scene changes. Inspect both sides of tail cuts; preserve result and final one-second hold:

```bash
qa_cut_frames=$(mktemp -d)
ffmpeg -v error -ss <cut-minus-0.25-seconds> -i raw-<evidence-name>.webm \
  -frames:v 1 "$qa_cut_frames/before.png"
ffmpeg -v error -ss <cut-plus-0.25-seconds> -i raw-<evidence-name>.webm \
  -frames:v 1 "$qa_cut_frames/after.png"
```

## Normalization

Encode without audio; only visually verified tail cut; omit unused `-to`:

```bash
ffmpeg -y -to <verified-end-seconds> -i raw-<evidence-name>.webm \
  -an -vf "fps=12,scale=1280:-2:force_original_aspect_ratio=decrease" \
  -c:v libvpx-vp9 -crf 36 -b:v 0 <evidence-name>.webm
```

## Validation

After probing, inspect final frames chronologically, four/second:

```bash
qa_final_frames=$(mktemp -d)
ffmpeg -v error -i <evidence-name>.webm -vf "fps=4" \
  "$qa_final_frames/frame-%03d.png"
```

Require `vp9`, width `1280`, duration ≤12 seconds; visible initial state, every action/transition, final result; each hold ≥four sampled frames. `ffprobe` alone is insufficient.

Only after every final passes probe and inspection, delete raw takes, cut-point and validation frames.
