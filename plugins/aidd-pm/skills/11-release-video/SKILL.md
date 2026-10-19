---
name: 11-release-video
description: Plans the release video, one scene per feature shipped since the last release. Use when preparing a release announcement video or when the release video check reports missing scenes. Not for rendering, publishing, or release notes.
argument-hint: release
---

# Release video

```mermaid
flowchart LR
  source([release]) --> plan --> done([scenes.json])
```

## Actions

| Action | Does |
| --- | --- |
| plan | cover every shipped feature with a scene, or a reason to skip it |

## Transversal rules

- The plan lives in `aidd_docs/release-video/scenes.json`; `scripts/check-release-video.js` is its judge.
- Show only what the product does; mark every invented demo value as an example on screen.
- Keep product choices with the user.
