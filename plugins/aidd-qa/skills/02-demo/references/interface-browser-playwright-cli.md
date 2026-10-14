# Browser recorder

## Invocation

Requires `npx`, `ffmpeg`, `ffprobe`.

```bash
cd <temporary-directory-outside-application> && npx --offline --no -- @playwright/cli@0.1.17 -s=demo-<run-id>-<journey-slug> <command>
```

Keep stdout, stderr and exit status visible.

## Recording

One session per journey.

1. `resize 1280 720`; reach initial state, then `video-start raw-<journey-slug>.webm --size=1280x720`.
2. All interactions in one `run-code 'async page => { ... }'`. Hold initial/verified final states `1000 ms`; pause `300 ms` between actions and after scrolls; before every click, focus and hover its target for `300 ms`.
3. Use bounded waits; log expected and observed results. Keep recording mismatches; execution errors invalidate the take.
4. Successful `run-code` => `video-stop`.

## Duration

Probe raw and encoded video:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height:format=duration \
  -of json <input.webm>
```

Maximum 12 seconds; no padding, acceleration or head cuts. If the journey cannot fit, return `blocked`.

For tail cuts, read both cut-point frames; preserve result and final hold:

```bash
qa_cut_frames=$(mktemp -d)
ffmpeg -v error -ss <cut-minus-0.25-seconds> -i raw-<journey-slug>.webm \
  -frames:v 1 "$qa_cut_frames/before.png"
ffmpeg -v error -ss <cut-plus-0.25-seconds> -i raw-<journey-slug>.webm \
  -frames:v 1 "$qa_cut_frames/after.png"
```

## Normalization

Use `-to` only for a verified tail cut:

```bash
ffmpeg -y -to <verified-end-seconds> -i raw-<journey-slug>.webm \
  -an -vf "fps=12,scale=1280:-2:force_original_aspect_ratio=decrease" \
  -c:v libvpx-vp9 -crf 36 -b:v 0 <absolute-destination>/<journey-slug>.webm
```

## Validation

Read every generated sheet in filename order:

```bash
qa_final_frames=$(mktemp -d)
ffmpeg -v error -i <absolute-destination>/<journey-slug>.webm -vf "fps=4,tile=2x4" \
  "$qa_final_frames/sheet-%03d.png"
```

Require `vp9`, width `1280`, ≤12 seconds; initial state, every action/transition, final result visible; holds ≥four frames.

Any unread sheet or unchecked hold => `blocked`. Delete raw takes/cut-point/validation frames only after all finals pass probe and inspection.
