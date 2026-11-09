<!-- Shows the sheet once, before anything is written. Send plain chat text, not in a code fence, with only this message: no lead-in, no closing line. Replace every `{{...}}`, delete every comment, leave out a section with nothing in it. Stop after the message: no offer to reverse a declined line, no "say ... if you want" closing. -->

Memory plan

<!-- Will write: a new file. Say what it will hold, from the sheet's lines, never only a count. -->

Will write
  {{file}}.md   {{what it holds}} ({{n}} lines)

<!-- Will change: an edit to existing lines, the old line then the new one or why it goes. -->

Will change
  D{{n}}  {{file}}.md
      "{{old line}}"
      → {{new line, or removed and why}}

<!-- One line per question. -->

Questions
  Q{{n}}  {{question}}

<!-- A setup only: the detected tools ticked. -->

Tools to wire
  [x] claude  [ ] codex  [ ] cursor  [ ] opencode  [ ] copilot

<!-- The one question, in the person's language; name in its example only a D line or a question that exists. -->

Does this look right? Say ok, or what to change, for example "not D{{n}}" or "Q{{n}}: …".

Sheet: aidd_docs/tasks/{{yyyy_mm}}/{{yyyy_mm_dd}}_memory-{{scope}}/facts.md
