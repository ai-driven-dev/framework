# 01 - Frame

Confirm the operation, the hook's name, its hosts, its intent and its event on each host.

## Input

The request, or the revision asked in plan.

## Process

1. Confirm the operation: add, update or remove.
2. Confirm the hook's kebab-case name.
   - Update or remove: name the existing hook, found by its script under a host's `hooks/` folder.
3. Confirm the hosts per [hosts.md](../references/hosts.md): offer the detected ones, and add or drop any the user names.
   - Update: start from the hosts that already carry the hook.
4. Confirm the intent per [hook-authoring.md](../references/hook-authoring.md), skipped on remove.
5. Map the intent to each host's event and matcher per [hosts.md](../references/hosts.md), dropping a host that cannot carry it with its reason.
   - No host left: stop, unsupported.
6. Read [plan](02-plan.md).

## Output

The confirmed operation, name, hosts, intent, and the event and matcher per host.
