---
status: in-progress
---

# Instruction: guard user-scope files

## Outcome

Before plugin update, remove, marketplace remove, or global user clean touches a Cursor user-scope file, compare current bytes with the installed digest already in the manifest. A changed, unreadable, or legacy-unproven file blocks that file's mutation and keeps ownership records truthful for manual reconciliation. Containment checks remain mandatory but are not content proof.

On update, a new path absent from the previous owned-file list must also be absent on disk. An existing user-created path is not an AIDD file merely because a later plugin version wants to write it.

For a plugin with both native refs and user files, prepare every file update and validate all old digests/new-path collisions before any native update. Applying a validated plan can still fail through unexpected I/O; retain truthful claims and name manual reconciliation rather than assert cross-host atomicity.

Recheck all planned old paths just before the file write. If a tracked path or parent becomes a symlink outside the user plugin root between planning and application, refuse rather than writing through it; a reduced safe-file map is not permission to continue.

## Verification

- Edited `plugin.json`/script octets survive all four operations; an unedited A contribution is still removable without harming B.
- A user-created `new.md` that collides with a new plugin-version file survives update byte-identically.
- A mixed native+file update collision causes no host call, no file change, and no claim change.
- A symlink substituted after planning cannot overwrite external bytes, even if the native host update has already succeeded.
- A partial failure does not detach a project or machine claim while its local state remains unproven.
- Targeted tests and destructive mutant witnesses, then the integrated full gates.
