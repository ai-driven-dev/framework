# Hook authoring

How to judge the shape of a hook. A hook is a config entry that runs a handler when a lifecycle moment occurs.

| Question | Judgment |
| --- | --- |
| Which moment | The narrowest that fits the intent. A hook that fires too broadly is a bug. |
| How many hooks | One hook, one purpose: one entry carries one handler intent. |
| Where the logic lives | A script, never inline in the config. The entry only points at it. |
| What a matcher is | A filter on which occurrences of a moment fire the hook, most often by tool name. Omit it to match every occurrence. |
| Which matcher | A precise one: the exact tool or path the hook cares about, not a broad pattern. |
