# Look

Look at each render before the person sees it.

## Browser

Find Chrome, Chromium or Edge on the machine.

- Never start a local server: the host may block it.
- The render links `tokens.css` by a relative path, so `file://` is enough.

## Capture

Take one screenshot per state and per width, into a temp folder.

- Widths: 390 for mobile, 1280 for desktop.
- Never write screenshots under `aidd_docs/`.
- Command, with the absolute path of the render:

```
"<browser>" --headless=new --hide-scrollbars --screenshot=<png> --window-size=390,844 file://<abs path>
```

- On macOS, `<browser>` is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- A line about a display link in the output is harmless.
- Use a window tall enough to show the whole state.
- If the states share one page, read each one in the capture.

## Read

Open each screenshot. Fix what reads badly, then capture again.

- The layout holds at both widths.
- No text wraps awkwardly: a badge or button stays on one line.
- Cards line up in a grid, with the same height.
- A missing image keeps its slot, with a neutral placeholder.
- Never use an emoji as a placeholder.
- One primary action stands out.
- Spacing comes from the tokens.
- The text is easy to read.
- Each state shows.
- A page that is blank or unstyled is a failure: fix it.

## No browser

Say so once, in plain words.

- Say you could not look at the page yourself.

- Ask the person to open the page and say what looks wrong.
- Fix what they name, then go on.
