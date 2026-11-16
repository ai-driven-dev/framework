# 02 - Render

Turn the accepted plan into the release video and look at it.

## Input

- `aidd_docs/release-video/scenes.json` that the check accepts.
- The version the release will carry, such as `5.13`: the next minor when a `feat:` shipped since the last tag.

## Process

1. Run `node .claude/skills/release-video/assets/check-release-video.js`.
   - Failure: go to step 6.
2. Run `node .claude/skills/release-video/assets/render-release-video.cjs --version <version> --out release-video.mp4`, which needs `npx`, a network, ffmpeg and Chrome.
   - It adds the music and the interface sounds of [sound.md](../references/sound.md).
3. Extract one frame near the end of each scene with `ffmpeg -ss <seconds> -i release-video.mp4 -frames:v 1`, and read them with `release-video.png`.
   - Overflow, cut text or wrong value: fix the plan, then render again.
   - Picture that does not say alone what the release brings: fix the plan, then render again.
4. Measure a second of the intro, of a scene and of the outro with `ffmpeg -ss <s> -t 1 -i release-video.mp4 -af volumedetect -vn -f null -`, and compare with the levels in [sound.md](../references/sound.md).
   - Say the levels were measured, not heard.
5. Report the path, the duration, and any avatar the script replaced by the logo.
6. Read [plan](01-plan.md) only when the check failed or a scene needs a fix the plan owns.

## Output

`release-video.mp4` in the working directory, and `release-video.png` beside it, the thumbnail that is also the video's first frame.

## Rules

- Type the real release version on screen, never a placeholder.
- Publish nothing.
