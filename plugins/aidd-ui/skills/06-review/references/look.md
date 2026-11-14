# Look

See a page the way the person will, before you give it.

| Topic | Rule |
| --- | --- |
| tool | Chrome, Chromium or Edge, headless, found on the machine |
| address | `file://` and the absolute path of the page |
| server | Never start one: no `http.server`, no `serve`. The host may block it |
| output | One PNG per width, in a temp folder, never under `aidd_docs/` |
| widths | 390 and 1280 |
| command | `"<browser>" --headless=new --hide-scrollbars --screenshot=<png> --window-size=<w>,<h> file://<path>` |
| blank or unstyled page | Report it. Do not give the page |
| no browser | Say so once. Ask the person to open the page and name what looks wrong |

Open each PNG. Do not describe a page you did not see.
