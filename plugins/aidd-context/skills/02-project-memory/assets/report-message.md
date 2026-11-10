<!-- Ends a request. Keep the plan's numbers. Send plain chat text, not in a code fence, with only this message: no lead-in, no closing line. Replace every `{{...}}`, delete every comment, leave out a section with nothing in it. Stop after the message: no offer to reverse a declined line, no "say ... if you want" closing. -->

Memory ready

<!-- At most one line per file written; a context file the sync rewrote is named too. -->

Written
  aidd_docs/memory: {{files}}
  {{context file}}: wired
  {{context file}}: memory block refreshed

<!-- At most one line per changed file, in what changed for the person. -->

Changed
  {{n}}. {{file}}.md: {{what changed}}

<!-- At most one line per left-out item. An unanswered question says how to add it later. -->

Left out
  {{n}}. {{file}}.md: you declined
  Q{{n}}  {{topic}}: unanswered. Tell me the answer any time and I add it to {{file}}.md.

<!-- At most one heads-up. Never name the engine's commands, their exit codes or the warning count. -->

Heads-up
  Every session loads {{n}} words from {{n}} files.
