# 02 - Render

Turn the accepted plan into the release video and look at it.

## Input

`aidd_docs/release-video/scenes.json` that the check accepts, and the version the release will carry, such as `5.13`: the next minor when a `feat:` shipped since the last tag, never a placeholder, because it is typed on screen.

## Output

`release-video.mp4` in the working directory.

## Process

1. **Check.** Run `node .claude/skills/release-video/assets/check-release-video.js`. On failure, return to [plan](01-plan.md).
2. **Render.** Run `node .claude/skills/release-video/assets/render-release-video.cjs --version <version> --out release-video.mp4`. It needs `npx`, a network, ffmpeg and Chrome, and adds the music and the interface sounds of [sound.md](../references/sound.md).
3. **Look.** Extract one frame near the end of each scene with `ffmpeg -ss <seconds> -i release-video.mp4 -frames:v 1` and read them.
   - Fix overflow, cut text and wrong values in the plan, then render again.
   - Judge each frame as a viewer with the sound off, who never read the release notes: the picture alone must say what the release brings.
4. **Measure.** Cut a second of the intro, of a scene and of the outro with `ffmpeg -ss <s> -t 1 -i release-video.mp4 -af volumedetect -vn -f null -` and compare with the levels in [sound.md](../references/sound.md). You cannot listen: say it was measured, not heard.
5. **Report.** Give the path, the duration, and any avatar the script replaced by the logo.

## Test

| Case | Pass |
| --- | --- |
| Plan the check refuses | no render; back to plan |
| Account that no longer exists | video renders; the replaced avatar is reported |
| Text that does not fit a window | seen on a frame, fixed in the plan, rendered again |
| Version typed on screen | the real release version, not a placeholder |
| Frame read with the sound off | the picture alone says what the release brings |
| Levels measured | the hook is loud, the bed about 10 dB lower under the scenes and the outro, the ending no louder than the bed, the interface sounds stand out of the bed |
| Finished render | MP4 present, duration reported, nothing published |
