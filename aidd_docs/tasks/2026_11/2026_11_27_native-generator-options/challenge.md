# Challenge: Native generator options

## Round 1

Aim: Generate requested native options through the installed context skills with deterministic target selection and a refusal before writing when the selected destinations are incompatible.

### Deal breakers

- None

### To decide

- None

### Suggestions

- None

### Holds

- A non-writable destination in the second skill target is refused in preview, for both an existing read-only file and a missing file under a read-only directory. The first target stays unchanged.
- Different requests that share a skill path are refused. Identical requests produce one write.
- An instruction glob mentioned only by a JSONC comment does not count as installed. The edited config preserves the original comments, duplicate entries and order.
- Kilo dispatched a child session from the generated command and denied an edit for the restricted agent. The same edit succeeded in the control agent against the same disposable file.
