# Ecosystem

```mermaid
flowchart LR
  Human([Human])
  Agent([Agent])
  App([App])
  GitHub["GitHub · vcs.md"]
  Board["Roadmap project board · backlog.md"]
  Discussions["GitHub Discussions · backlog.md"]
  Npm["npm registry · deployment.md"]
  Packages["GitHub Packages · deployment.md"]
  Discord["Discord · human only"]
  ReleasePlease["release-please · deployment.md"]
  Dependabot["Dependabot · deployment.md"]

  Human -- web --> Discord
  Agent -- cli --> GitHub
  Agent -- cli --> Board
  Agent -- cli --> Discussions
  App -- http --> GitHub
  App -- http --> Npm

  Dependabot -- "dependency update PR" --> GitHub
  ReleasePlease -- "release PR, then tags" --> GitHub
  GitHub -- "released paths" --> Npm
  GitHub -- "npm package, best-effort" --> Packages
```
