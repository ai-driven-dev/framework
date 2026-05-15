# 04 - Review memory

Spawn a single review agent with all memory files in context to catch cross-file inconsistencies that per-file agents cannot detect.

## Inputs

- `aidd_docs/memory/` directory populated with generated memory files.

## Outputs

```
aidd_docs/memory/
  <file>.md   ← corrected in place where needed

Status table delivered to user:
  file | status (✅ clean | ✅ fixed: <reason> | ❌ manual review needed)
```

## Depends on

- `03-generate-memory`

## Process

1. Read all `.md` files from `aidd_docs/memory/` (recursive, all subdirs).
2. Launch an agent to review all files for consistency and accuracy
3. Deliver the status table.

## Test

Review agent delivers the status table and no file has status `❌` after the review pass.
