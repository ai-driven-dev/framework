# Sound

The renderer adds two layers, both original.

| Layer | What | Where |
| --- | --- | --- |
| Music | a stereo track in three parts: a hook, a bed a few dB under it, a small ending; felt piano and soft pads over a gentle pulse | `assets/music.mp3`, used by every render; `--music <file>` replaces it for one |
| Interface sounds | short soft tones, like struck glass, and a breath of air; no chip-tune waves | `soundCues` and `soundTrack` in `assets/render-release-video.cjs` |

Everything that appears has a sound, at the time the timeline shows it.

| Moment | Sound |
| --- | --- |
| the version typed in the intro | a key tick per character |
| a pill, the release label or a lead appears | a tick |
| a title, a window, an item, a note, the outro logo or title appears | a pop |
| a row appears | a click |
| a scene opens | a whoosh |

The sounds take their times from the animation: changing the plan moves them, nothing is placed by hand.

| Part of the track | Plays under | Level in the video |
| --- | --- | --- |
| hook | the intro, which ends on a bar line | about -22 dB |
| bed | the scenes, looped, and the outro | about -26 dB, 4 dB under the hook: a step, never a drop |
| ending | the outro slide: the four-note motif as it opens, then a held chord that dies away | about the bed's level, never louder |

The levels are the mean volume of one second of the whole video, music and sounds together.

| Fact | Detail |
| --- | --- |
| the shape | a hook of 6.5 s (13 beats, the intro with tags), a bed of 8 bars that loops, an ending of 4 s. A track with no hook at least 3 dB over its median is only looped |
| the motif | four rising notes, A C E A, open the hook and the ending: the signature of the brand |
| the generator | `assets/compose-music.py`, numpy, 120 BPM, A minor, D, E minor, D, stereo |
| the limit | an intro without tags lasts 5 s: the hook is cut before its last beats and the bed joins off the bar line |
| taste | a track that tires is replaced by another original one; nothing else changes |
