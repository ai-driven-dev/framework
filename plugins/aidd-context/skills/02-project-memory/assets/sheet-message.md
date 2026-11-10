<!-- Shows the sheet once, before anything is written. Send plain chat text, not in a code fence, with only this message: no lead-in, no closing line. Replace every `{{...}}`, delete every comment, leave out a section with nothing in it. Number the items 1 to n across Will write, Will add, Will change and Will delete: a number in the answer means the sheet lines behind that item. Stop after the message: no offer to reverse a declined line, no "say ... if you want" closing. -->

Memory plan

<!-- Since: a refresh only, from the `Since` line `changes` printed: its sha, relative date and counts; information, never a question. -->

Changes since the last memory update ({{short sha}}, {{relative date}}): {{n}} commits, {{m}} files

<!-- Will write: a new file. Say what it will hold, from the sheet's lines, never only a count. -->

Will write
  {{n}}. {{file}}.md   {{what it holds}}

<!-- Will add: lines added to an existing file, each written out as it will read. -->

Will add
  {{n}}. {{file}}.md, {{section}}
     + {{line as it will read}}

<!-- Will change: an edit to existing lines or a moved file: the start of the old line, then the new text or "same facts, split into a list". Name any fact the change drops. -->

Will change
  {{n}}. {{file}}.md: "{{start of the old line}}…"
     → {{new text, or same facts split into a list}}

<!-- Will delete: a line that goes, quoted whole, then why. -->

Will delete
  {{n}}. {{file}}.md: "{{the whole line}}"
     why: {{why it goes}}

<!-- One line per question. -->

Questions
  Q{{n}}  {{question}}

<!-- Tools: never left out, on a setup or a refresh. Ticked: on a setup the detected tools, on a refresh the wired ones; the others unticked. -->

Tools to wire
  [x] claude  [ ] codex  [ ] cursor  [ ] opencode  [ ] copilot

<!-- The one question, in the person's language; name in its example only a number or a question that exists. -->

Does this look right? Say ok, or what to change, for example "not {{n}}" or "Q{{n}}: …".

Sheet: aidd_docs/tasks/{{yyyy_mm}}/{{yyyy_mm_dd}}_memory-{{scope}}/facts.md
