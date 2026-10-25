---
name: release-video
description: Plans and renders the release video, one scene per feature shipped since the last release, with its music and interface sounds. Use when the user wants to prepare the release announcement video, change its music, or the release video check reports missing scenes. Not for publishing the video or writing release notes.
argument-hint: release version | music
---

# Release video

```mermaid
flowchart LR
  source([release]) --> plan --> render --> done([release-video.mp4])
  render -->|"scene to fix"| plan
  track([music]) --> compose-music --> render
```

## Actions

Run the flow above. Read only the next action file.

| Action | Does |
| --- | --- |
| plan | cover every shipped feature with a scene, or a reason to skip it |
| render | turn the plan into the MP4 and check it on screen |
| compose-music | write a new track when the user asks for other music |

## Transversal rules

- The plan lives in `aidd_docs/release-video/scenes.json`; the check and the renderer are in `assets/`, their tests in `scripts/__tests__/`.
- Show only what the product does; mark every invented demo value as an example on screen.
- A viewer may watch with the sound off and never read the release notes: the picture carries the message, the sound only makes it lively.
- Never reuse the audio of a published video: it carries that video's own sounds, which then play at moments that mean nothing here.
- Keep product choices with the user, music included: it is judged by listening, which is the user's.
- Stop at the MP4: attaching it to a release and announcing it are the user's.
