# 01 - Capture rule

## Input

A topic, `auto`, or an existing publish/delete selection. Empty means manual.

## Output

Confirmed operation, topic, category, slug, description, scope and destinations.

## Process

1. **Gate.** Read [tool-paths.md](../references/tool-paths.md).
   - For publish/delete, confirm existing sources and hosts; continue to action 03.
   - Publishing manual canonical body edits uses this bypass.
2. **Topic.** Confirm the topic, or scan and propose rules in auto mode.
3. **Place.** Choose category and slug through [rule-authoring.md](../references/rule-authoring.md).
4. **Scope.** State literal globs or all files, with a one-line description.
5. **Destinations.** Confirm detected supported hosts or the plugin source directory.
   - Report unsupported hosts and alternatives.
