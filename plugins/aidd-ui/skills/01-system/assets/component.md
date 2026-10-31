---
id: {{component id}}
kind: {{atom, molecule or composition}}
status: proposed
version: 1
uses: [{{ids of the elements it uses, of its level or lower}}]
tokens: [{{semantic tokens its render uses}}]
variants: [{{variants, or default when it has one only}}]
states: [{{default, then focus when interactive, then hover, disabled, loading or error when they exist}}]
interactive: {{yes or no}}
role: {{accessible role}}
---

<!-- Replace every `{{...}}` with its answer and delete every comment. Delete `## Keyboard` when interactive is no. Once the code exists, add `code: <path>#<Export>`, or `code: package:<name>#<Export>` for a library component, and `implemented-version: 1` to the front matter. -->

# {{Component name}}

## Usage

{{when to use it, and when not}}

## Keyboard

{{how the keyboard drives it}}

## History

| Version | Change | Breaking | Task |
| --- | --- | --- | --- |
| 1 | created | no | {{task folder}} |
