# Look

Check each render yourself before the person judges it.

| Topic | Rule |
| --- | --- |
| tool | Chrome, Chromium or Edge, headless, found on the machine |
| address | `file://` and the absolute path of the render. `tokens.css` is linked relatively, so it loads |
| server | Never start one. The host may block it |
| output | One PNG per state and width, in a temp folder. Only you open them |
| widths | 390 and 1280 |
| command | `"<browser>" --headless=new --hide-scrollbars --screenshot=<png> --window-size=<w>,<h> file://<path>` |
| order | One capture at a time. Wait for it to end. Never start two together, never use `&` or a parallel loop |
| time limit | Give each capture a timeout of 30 seconds |
| cleanup | After each capture, kill the browser if it still runs |
| scope | Only the renders this step wrote or changed. Never the whole showcase |
| read | Fix wrapping text, uneven sizes, a missing state, a blank page |
| no browser | Say so once. Ask the person to open the page and name what looks wrong |
