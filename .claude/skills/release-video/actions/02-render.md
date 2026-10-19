# 02 - Render

Turn the accepted plan into the release video and look at it.

## Input

`aidd_docs/release-video/scenes.json` that `node scripts/check-release-video.js` accepts, and the release version, such as `5.13`.

## Output

`release-video.mp4` in the working directory.

## Process

1. **Check.** Run `node scripts/check-release-video.js`. On failure, return to [plan](01-plan.md).
2. **Render.** Run `node scripts/render-release-video.cjs --version <version> --out release-video.mp4`. It needs `npx`, a network, ffmpeg and Chrome.
3. **Look.** Extract one frame near the end of each scene with `ffmpeg -ss <seconds> -i release-video.mp4 -frames:v 1` and read them. Fix overflow, cut text and wrong values in the plan, then render again.
4. **Report.** Give the path, the duration, and any avatar the script replaced by the logo.

## Test

| Case | Pass |
| --- | --- |
| Plan the check refuses | no render; back to plan |
| Account that no longer exists | video renders; the replaced avatar is reported |
| Text that does not fit a window | seen on a frame, fixed in the plan, rendered again |
| Finished render | MP4 present, duration reported, nothing published |
