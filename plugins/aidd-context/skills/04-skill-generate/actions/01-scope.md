# 01 - Scope

## Goal

Frame the skill before any file is touched.

## Input

A free-form request to create a skill.

## Process

1. **Detect.** Detect the installed tools per `@../references/tool-detect.md`.
2. **Fill.** For each field in `@../references/scope-frame.md`, propose a value or ask one question.
3. **Check.** Check the name per `@../references/naming.md` and surface any overlap.
4. **Confirm.** Hand the confirmed frame to plan.

## Output

The confirmed frame, written nowhere, per `@../references/scope-frame.md`.

## Test

- The run writes nothing: `git status --porcelain` reads the same after as before.
- The installed skills were listed, and every name or trigger overlap was surfaced or noted as none.
- The user answered one frame field at a time.
- The target is set and confirmed before the frame is handed to plan.
