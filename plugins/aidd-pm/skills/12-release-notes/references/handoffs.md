# Handoffs

Offer the named capability with what was observed, then stop. Never invoke it silently, never write outside the release notes.

| Observed | Capability | Return |
| --- | --- | --- |
| the release has no tag or version yet | release tag | the notes resume once the tag exists |
| a product mismatch shipped in the range | Defect | the notes list it as a known limitation |
| shipped work with no ticket that the user wants tracked | Task | the notes keep it as an untracked change |
| no match | none | report what was observed |
