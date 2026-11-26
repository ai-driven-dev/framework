# 01 - Frame

Confirm the operation, the name, the hosts, and what each host does for the need.

## Input

The need, or the revision plan sends back.

## Process

1. Confirm the operation: add, update or remove.
2. Confirm the hook's kebab-case name.
   - Update or remove: name the existing hook, found by its file in a host's folder.
3. Confirm the hosts per [hosts.md](../references/hosts.md): offer the detected ones, and add or drop any the user names, skipped on remove.
4. Restate the need as one moment and one effect per [hook-authoring.md](../references/hook-authoring.md), skipped on remove.
5. Run the writer's describe mode on the hosts per [writer.md](../references/writer.md), skipped on remove.
6. Pair each host with the event and answer its description gives for the moment and effect, skipped on remove.
   - A host with none: drop it with its reason.
   - No host left: stop, unsupported.
7. Read [plan](02-plan.md).

## Output

The operation, the name, and per host its event and answer.
