# Wiring proof

Phase 2's task 5 asks for a recorded live refusal, because everything else about this guard
is verified upstream of the seam that matters: the tests spawn the hook script and pipe it a
payload, which proves the script and never proves the wire. The matcher string, the
`$CLAUDE_PROJECT_DIR` expansion inside the command, and `node` being on `PATH` are only
exercised by a real tool call — and the hook fails open at every one of those steps, so a
broken wire looks exactly like a clean tree.

Both calls below were made with the Write tool, in this repository, against
`.claude/settings.json` as committed.

## A refusal

Writing `plugins/aidd-dev/skills/03-assert/references/wiring-proof.md`, a reference file in a
recipe skill, with this body:

```md
# Wiring proof

Hand the result to `/aidd-vcs:01-commit` once every assertion passes.
```

The call was refused. Verbatim, as it reached the author:

```text
plugins/aidd-dev/skills/03-assert/references/wiring-proof.md:3 addresses sibling plugin "aidd-vcs" via "/aidd-vcs:01-commit". Fix: name the concept aidd-vcs owns instead of addressing it directly.
```

The file was never created — `ls` on that path answers `No such file or directory`.

## The same address, legitimately

Writing `plugins/aidd-dev/agents/wiring-proof.md` with the same address under the heading
`docs/ARCHITECTURE.md` sanctions:

```md
# Skills you may invoke

- `/aidd-vcs:01-commit`
```

The call was applied, with no output. The probe was removed in the same turn;
`git status --porcelain plugins/` is empty.

## What this settles

| Claim | Settled by |
| --- | --- |
| The hook is reachable from the matcher as wired | the refusal arrived at all |
| It decides before the write, not after | the refused path does not exist |
| The refusal names file, line and owning plugin | the verbatim text above |
| A legitimate permission list is not refused | the second call was applied silently |
