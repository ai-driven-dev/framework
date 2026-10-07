# 03 - Target edits

Render the evidence and minimal edits.

## Input

The evidence boundary, timeline, timing, usage, coverage, and recommendations.

## Output

An HTML report in a temporary directory with local `report.css` and `report.js`, plus its path and a next-intent request.

## Process

1. **Render.** Fill [the report template](../assets/report-template.html) from the provided data; remove its sample and copy its local CSS and JavaScript into the allowed unique temporary directory. Never resolve, judge, or apply sources here.
   - Escape injected values; allow only template markup and local assets. Localize HTML `lang`, UI text, and dynamic `data-label-*` text; preserve quoted evidence.
   - Start with elapsed seconds, tokens, and call counts only. Use exposed usage only; distinguish linked subcalls. No visible dates or coverage. Keep text sizes uniform except titles and user prompts.
   - Show full user prompts in labelled blockquotes, followed by compact calls: tool, relative path or command, and elapsed gap since the previous displayed event. Nest only exposed subcalls; preserve chronological order and parallel relationships.
   - Derive gaps only from recorded timestamps; distinguish them from call durations. Omit assistant prose, raw payloads, and evidence explanations. No dropdowns.
   - Put recommendations below: an actionable title, one relative path, and unlabelled red `−` / green `+` columns. Use `—` for an empty side; omit descriptions and proof links.
   - Keep black emoji tags, accept controls, and the editable prompt; copy each `data-prompt` unchanged. No filters, print control, target table, or limitations section.
2. **Return.** Return its path. Ask the user, in their language, which small general change in intent to apply next run for cumulative, measurable improvement.
