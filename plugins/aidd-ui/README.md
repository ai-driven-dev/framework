← [aidd-framework](../../README.md)

# aidd-ui 🚧 alpha

UI and UX concern for the AI-Driven Development framework.

> ⚠️ **ALPHA: NOT READY FOR USE.** `0.1.0-alpha.0`. This plugin ships a single smoke-test skill and no real UI/UX capability yet. Do not install it expecting to use it; it exists only to validate the scaffold. APIs, skills, and naming may change or be removed without notice.

> Status: alpha (experimental).

This plugin is in alpha (`0.1.0-alpha.0`). It lives on a dedicated branch off `next` and is registered with `recommended: false`, so it stays off the curated install path until it stabilises and graduates to `main`. While it is not in the published marketplace yet, test it from a local checkout of this branch:

```
claude --plugin-dir plugins/aidd-ui          # zero-marketplace, session-scoped
# or, persistent:
/plugin marketplace add .                      # register this checkout as a local marketplace
/plugin install aidd-ui@aidd-framework
```

Then run `aidd-ui:01-hello` to confirm it loads.

One starter skill today; real UI and UX skills land as the concern stabilises.

## Skills

| Bracket ID | Skill | Description |
| ---------- | ----- | ----------- |
| [7.1] | [hello](skills/01-hello/README.md) | Smoke-test skill that confirms the plugin loads. |
