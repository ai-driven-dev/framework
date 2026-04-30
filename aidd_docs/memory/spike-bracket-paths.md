# Spike: Bracket-in-Path Skill Names

## Decision

Bracket naming (`[1.1] project-init/`, `[3.1] commit/`, etc.) is SAFE for use in the plugin skill directory structure.

## Test Results (macOS, Node.js)

Test run: 2026-04-29

### OS-level directory creation

```
Created: /var/folders/...T/[1.1] test-skill
Exists: true
Found in parent: ['[1.1] test-skill']
```

Brackets are valid directory name characters on macOS (HFS+/APFS) and Linux (ext4). Windows NTFS also permits brackets.

### Node.js fs.readdir() with bracket directories

```
Skills found: ["[1.1] project-init","[2.0] sdlc","[3.1] commit"]
File exists: true (path.join + bracket path)
```

`fs.readdir()` returns bracket names verbatim. `path.join()` handles them correctly.

### Regex parsing of bracket names

Pattern `/^\[(\d+\.\d+)\]\s+(.+)$/` correctly extracts:
- `[1.1] project-init` → `{num: "1.1", name: "project-init"}`
- `[2.0] sdlc` → `{num: "2.0", name: "sdlc"}`
- `[3.1] commit` → `{num: "3.1", name: "commit"}`

### CLI pipeline analysis

`FileSystemAdapter.listDirectory()` uses `readdir()` recursively with no name filtering — bracket names pass through unchanged.

`isComponentFile()` in `plugin-distribution-reader-adapter.ts` only checks the top-level path segment (`skills`, `commands`, etc.) — bracket names in subdirectory paths are transparent.

`PLUGIN_NAME_REGEX` (`/^[a-z0-9]+(-[a-z0-9]+)*$/`) applies only to the plugin `name` field in `plugin.json`, not to skill folder names.

### Known risk: shell glob patterns

Bash glob patterns interpret `[...]` as character class expansion. Example:

```bash
# DANGEROUS — shell interprets brackets
ls plugins/aidd-vcs/skills/[3.1] commit/

# SAFE — quote the path
ls "plugins/aidd-vcs/skills/[3.1] commit/"
```

Any shell scripts (build-dist.sh, lefthook.yml, etc.) that use unquoted glob patterns over skill directories will need to quote paths or use `find` with `-name` instead of glob.

## Conclusion

Bracket naming is safe for:
- Node.js fs operations (all pass through)
- CLI installation pipeline (validated end-to-end)
- Git (treats as normal directory names)

Bracket naming requires care in:
- Shell scripts — always quote paths containing `[...]`
- `find` commands — use `-name "[3.1]*"` (quoted) or escape `\[`

## Recommendation

Proceed with bracket naming. Add a build script rule: all paths containing `[...]` must be double-quoted in shell contexts.
