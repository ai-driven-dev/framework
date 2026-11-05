# Ecosystem

{{Which tools outside the repo does the project use? Draw one edge per actor access and per hand-off, then delete this line.}}

```mermaid
flowchart LR
  Human([Human])
  Agent([Agent])
  App([App])
  Vcs["{{vcs platform}} · vcs.md"]
  Tracker["{{tracker}} · backlog.md"]
  Service["{{runtime service}}"]
  Chat["{{tool}} · human only"]
  Bot["{{autonomous tool}}"]

  Agent -- cli --> Vcs
  Agent -- mcp --> Tracker
  App -- http --> Service
  Human -- web --> Chat

  Vcs -- "{{trigger}}" --> Tracker
  Bot -- "{{trigger}}" --> Vcs
```
