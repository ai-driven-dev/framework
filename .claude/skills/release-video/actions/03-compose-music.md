# 03 - Compose music

Write a new original 8-bit track when the current one tires or does not fit.

## Input

What to change, in the user's words: slower, calmer, another mood.

## Output

`assets/music.mp3` in this skill, which every render then uses; the next step is [render](02-render.md).

## Process

1. **Shape.** Edit `assets/compose-music.py`: tempo, chords and levels, keeping the three parts of [sound.md](../references/sound.md).
2. **Compose.** Run `python3 .claude/skills/release-video/assets/compose-music.py <out.wav>`; it needs numpy.
3. **Encode.** Run `ffmpeg -i <out.wav> -b:a 128k .claude/skills/release-video/assets/music.mp3`.
4. **Hear.** Render per [render](02-render.md) and give the user the MP4 and the track to listen to.
   - Keep the track only on the user's word.

## Test

| Case | Pass |
| --- | --- |
| Script run | a wav of about 44 seconds, with hook, bed and ending levels printed |
| Track used by a render | the measured levels keep the loud, calm, loud shape |
| Track from another video | refused: only an original composition is kept |
| User has not listened | the track is not declared good, only measured |
