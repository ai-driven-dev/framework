---
name: release-video
description: Plans and renders the release video, one scene per feature shipped since the last release. Use when preparing a release announcement video or when the release video check reports missing scenes. Not for publishing the video or writing release notes.
argument-hint: release version
---

# Release video

```mermaid
flowchart LR
  source([release]) --> plan --> render --> done([release-video.mp4])
  render -->|"scene to fix"| plan
```

## Actions

Run the flow above. Read only the next action file.

| Action | Does |
| --- | --- |
| plan | cover every shipped feature with a scene, or a reason to skip it |
| render | turn the plan into the MP4 and check it on screen |

## Transversal rules

- The plan lives in `aidd_docs/release-video/scenes.json`; `scripts/check-release-video.js` is its judge and `scripts/render-release-video.cjs` its renderer.
- Show only what the product does; mark every invented demo value as an example on screen.
- Keep product choices with the user.
- Stop at the MP4: attaching it to a release and announcing it are the user's.
