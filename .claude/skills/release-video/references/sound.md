# Sound

The renderer adds two layers, both original.

| Layer | What | Where |
| --- | --- | --- |
| Music | an 8-bit track in three parts: a loud hook, a calm bed, a small ending | `assets/music.mp3`, used by every render; `--music <file>` replaces it for one |
| Interface sounds | short 8-bit blips from square and triangle waves, no noise | `soundCues` and `soundTrack` in `assets/render-release-video.cjs` |

| Moment | Sound |
| --- | --- |
| the version typed in the intro | a key tick per character |
| a window or item slides in | a pop |
| a row appears | a click |
| a scene opens | a whoosh |

The sounds take their times from the animation: changing the plan moves them, nothing is placed by hand.

| Part of the track | Plays under | Level in the video |
| --- | --- | --- |
| hook | the intro | about -19 dB |
| bed | the scenes and the outro, looped | about -29 dB, 10 dB under the hook |
| ending | the outro slide: four rising notes as it opens, then a held chord that dies away | about -26 dB, never louder than a few dB above the bed |
| interface sounds | everything | peaks about -12 dB, above the bed |

| Fact | Detail |
| --- | --- |
| the shape | a track with no loud hook is only looped under everything; its ending is its last 4 seconds before silence, as long as the outro it opens, and stays quiet |
| the generator | `assets/compose-music.py`, numpy, 120 BPM, an A minor, F, C, G loop |
| taste | a track that tires is replaced by another original one; nothing else changes |
