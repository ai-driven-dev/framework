# Findings

| Finding | When | Evidence |
| --- | --- | --- |
| Files to modify, create, delete | always | read in the code, one-line reason each |
| Runtime impact | the feature relies on something outside the repository | observed: validated; else unverified or missing |
| Regression impact | it changes existing code | tests covering the areas, risk (low, medium, high), safety-net phase of tests that lock the current behavior (yes, no) |
| Architecture impact | it changes how parts connect | the architecture it starts from, the change it intends |
| Documentation impact | always | documents to change and why, or none |
| Docs consulted | an assumption the code cannot settle | official URL, what it settled |
| Project rules | they govern the feature | one-line reason each |
