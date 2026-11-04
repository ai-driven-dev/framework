---
id: {{component id}}
kind: {{atom, molecule or composition}}
status: proposed
version: 1
uses: [{{ids it uses}}]
tokens: [{{semantic tokens}}]
variants: [{{variants}}]
states: [{{states}}]
role: {{accessible role}}
---

# {{Component name}}

## Usage

{{when to use it, and when not}}

## Keyboard

{{how the keyboard drives it}}

## History

| Version | Change | Breaking | Task |
| --- | --- | --- | --- |
| 1 | created | no | {{task folder}} |

<!--
- Replace every `{{...}}` and delete every comment.
- An axis is `axis=value`, such as `variants: [size=sm, size=md, tone=danger]`; a bare item is a plain variant.
- Delete `## Keyboard` when `states` lacks `focus`.
- Once coded, add `code` to the front matter: `path[#Export]@<version>`, a list for several platforms.
- Add `platforms: [..]`, a subset of the system's, only when the component is not on all of them.
-->
