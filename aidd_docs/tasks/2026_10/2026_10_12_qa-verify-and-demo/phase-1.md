---
status: done
---

# Instruction: split

## Architecture projection

```txt
plugins/aidd-qa/
├── .claude-plugin/plugin.json                       ✏️ lists 02-demo
└── skills/
    ├── 01-acceptance-qa/                            ✏️ verify only: no recording, encoding, ffmpeg
    └── 02-demo/                                     ✅ the recording rules, moved unchanged
```

## Acceptance criteria

- Verify writes `qa.md` with no video, and needs no `ffmpeg`.
- On the golden fixtures, verdicts by criterion, run verdict, out-of-interface and rejected sets match `next`.
- The demo records a `qa.md` scenario with the moved rules: VP9, 1280 wide, at most 12 s.
