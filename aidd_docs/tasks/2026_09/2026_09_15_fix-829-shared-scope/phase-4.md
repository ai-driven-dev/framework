---
status: in-progress
---

# Instruction: preserve edited local integration

## Outcome

OpenCode MCP and Cursor project hooks/scripts are user-owned after installation. Compare each current contribution with its recorded install digest before unmerge or deletion. Edited or legacy-unproven entries refuse local detach and preserve claims for manual reconciliation. Reinstall must treat edited MCP as a user collision. Do not delete an entire script directory by plugin name.

Content digest is not path confinement: reject a hooks config, script/parent directory, or MCP output whose resolved path leaves canonical projectRoot, even if the external bytes match the install digest. Preflight before native/shared claims move, then revalidate immediately before write/delete.

## Verification

- A/B remove and clean preserve B and edited project integration; unedited A contributions are removed precisely.
- A failed read/write or digest mismatch leaves A projection/claim truthful and retry-safe.
- Project clean preflights edited hooks before dropping a shared-source reference or undoing any native registration; removal rechecks immediately before write.
- Symlinked hooks config, script parent, and MCP output outside the project remain byte-identical; claims and B remain untouched.
- Targeted RED→GREEN tests and destructive mutation witnesses; full gates run on integrated tree.
