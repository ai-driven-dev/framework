# {{Hook name}}

The handler script, one per hook. The writer renders each host's entry from its `runner`, `extension` and `hosts` input.

```js
"use strict";
// {{what the hook does, and when}}
const payload = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
{{the check on payload, answering on stdout or exiting 2 to block}}
```

> Fill every `{{...}}` and delete this line.
