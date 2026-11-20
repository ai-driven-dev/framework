# {{Hook name}}

## hooks.json entry

```json
{
  "hooks": {
    "{{Event}}": [
      {
        "matcher": "{{tool or source filter, or delete this line}}",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/{{name}}.cjs",
            "timeout": 5,
            "statusMessage": "{{what the user sees while it runs}}"
          }
        ]
      }
    ]
  }
}
```

## Handler skeleton

```js
"use strict";
// {{what the hook does, and when}}
const payload = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
{{the check on payload, answering on stdout or exiting 2 to block}}
```

> Fill every `{{...}}` and delete this line.
