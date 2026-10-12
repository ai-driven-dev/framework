# 01 - Capture rule

## Input

Topic, `auto`, or publish/delete selection. Empty means manual.

## Process

1. **Gate.** Read [tool-paths.md](../references/tool-paths.md).
   - Publish/delete: confirm sources and hosts, then action 03; manual canonical body edits remain publishable.
2. **Capture.** Confirm topic, category/slug, description and scope through [rule-authoring.md](../references/rule-authoring.md).
   - Auto: scan and propose rules first.
3. **Target.** Confirm supported hosts or plugin directory; report unsupported hosts and alternatives.
