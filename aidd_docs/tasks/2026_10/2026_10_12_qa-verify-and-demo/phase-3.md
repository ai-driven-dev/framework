---
status: done
---

# Instruction: demo

## Architecture projection

```txt
plugins/aidd-qa/skills/02-demo/                      ✏️ browser video and CLI transcript
```

## Acceptance criteria

- A browser journey yields one video; a CLI journey yields the command and its output.
- A failing journey is shown as observed and labelled not expected.
- Invoked by another skill or agent, it asks nothing and returns its paths.
- A video lands in the folder the caller names, else beside the journey's source, never in a temporary directory.
- A video is named after its journey, never `happy-path` for a bug.
