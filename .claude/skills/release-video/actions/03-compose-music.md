# 03 - Compose music

Write a new original track when the current one tires or does not fit.

## Input

What to change, in the user's words: slower, calmer, another mood.

## Process

1. Edit `assets/compose-music.py`, tempo, chords and levels, keeping the three parts and the bar lengths of [sound.md](../references/sound.md).
2. Run `python3 .claude/skills/release-video/assets/compose-music.py <out.wav>`, which needs numpy.
3. Run `ffmpeg -i <out.wav> -b:a 160k .claude/skills/release-video/assets/music.mp3`.
4. Render per [render](02-render.md), and give the user the MP4 and the track to listen to.
   - Keep the track only on the user's word.

## Output

`assets/music.mp3` in this skill, which every render then uses.

## Rules

- Keep only an original composition, never a track from another video.
