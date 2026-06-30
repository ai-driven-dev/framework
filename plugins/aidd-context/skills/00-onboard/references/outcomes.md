# Act outcomes

What `03-act` carries out for each choice, and whether it loops back to `01`. Only ever run or name a skill that `01` found installed.

| Choice           | What happens                                                                                  | Loop back to 01?            |
| ---------------- | --------------------------------------------------------------------------------------------- | --------------------------- |
| Run it           | Invoke the resolved skill in this session, then ask the user how it went                       | yes — refresh + mark done   |
| Hand off         | Give the exact command to run in a fresh session, wait for the user to return                  | yes — refresh + mark done   |
| Different step   | Mark the declined step skipped, hand back to `02-orient` to pick another, resolve it           | no — back to 02             |
| Explain the step | Describe the step and its skill in two or three plain lines, then re-offer the choices         | no — re-offer               |
| Explain project  | Summarize the project from its memory bank, read-only, then re-offer (only when memory filled) | no — re-offer               |
| Show flow + skills | Walk the AIDD flow (`journey.md`) and list the installed skills grouped by step, then re-offer | no — re-offer             |
| Stop             | A one-line goodbye, end the loop                                                               | no — terminate              |
| A gap            | The step has no installed skill: say it needs a plugin, by function only; offer explain, a different step, or stop | no — re-offer |
