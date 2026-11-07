---
objective: "The file port has one contract suite run against the in-memory double and the real adapter, the double stores bytes and no longer carries its own merge, every divergence found is a test that failed on the double first and was fixed in the double, and the real-adapter tests the suite covers are gone, with no product behaviour changed."
status: pending
---

# Plan: PR 5 of stage A, file port contract

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | A `contract` level and project, `describeFileContract(makeSubject)` run on `InMemoryFileAdapter` and `FileAdapter`, the JSON merge moved out of the double into product code both adapters call, the double fixed wherever it lied, and the redundant real-adapter tests deleted by inverted proof. |
| **Source** | Text contract (stage A step 5), grounded in `target/07-test-architecture.md` sections 1, 2.3, 8 (`tests/helpers/ports/` row) and 9 step 5, and `target/00-overview.md` sections 6 and 10. |

Out of scope, left to later PRs: contracts for telemetry stores, private storage (`src/contexts/telemetry/domain/ports/private-storage.ts`, listed apart in doc 07 section 2.3), the hasher, the manifest and the host CLIs; moving the kit to `tests/shared/testing/` (doc 07 step 10); removing `build-unit-deps`; the e2e policy.

Every path is relative to the repository root unless it follows a `cd cli`. `$B` is the baseline directory of phase 1: `B="${TMPDIR:-/tmp}/aidd-pr5-baseline"`. Nothing is committed. No phase runs `aidd` or a product command by hand.

## The port

The file port is the pair every consumer and both implementations take together (`FileReader & FileWriter`, for example `src/runtime/wiring/framework.ts:132`); doc 07 section 2.3 treats it as one port. `FileMerger` is a third interface both classes implement.

| Interface | File | Methods |
| --- | --- | --- |
| `FileReader` | `cli/src/kernel/ports/file-reader.ts:3-27` | `readFile(path)`, `listDirectory(path)` (recursive, relative, `/`-separated), `fileExists(path)`, `readFileHash(path)`, `listFilesRecursive(dirPath)` (absolute), `isExecutable(path)`, `realpath(path)` (resolves symlinks and `..`, throws `ENOENT` when missing) |
| `FileWriter` | `cli/src/kernel/ports/file-writer.ts:1-7` | `writeFile(path, content)`, `deleteFile(path)`, `createDirectory(path)`, `deleteEmptyDirectories(path)`, `deleteDirectory(path)` |
| `FileMerger` | `cli/src/contexts/tools/domain/ports/file-merger.ts:3-5` | `mergeJsonFile(path, content, strategy)` |

Real adapter: `cli/src/runtime/filesystem/file-adapter.ts` (`FileAdapter`, writes through `atomic-write.ts`). Doubles: `cli/tests/helpers/ports/in-memory-file-adapter.ts` (`InMemoryFileAdapter`, 247 lines) and `faulting-file-adapter.ts`, which extends it. Measured: 113 test files import `InMemoryFileAdapter` (61 unit, 52 integration), plus 5 helpers; 8 files import the real adapter, two of them its own tests.

## Divergences suspected from reading

Each line is a hypothesis until phase 3 or phase 2 shows a test red on the double. "Caller" is the product code that sends that input, which is what earns a fix rather than a written limit (decision D6).

| # | Behaviour | Double | Real adapter | Caller that sends the input | Planned |
| --- | --- | --- | --- | --- | --- |
| V1 | merge into an unparsable file | overwrites (`in-memory-file-adapter.ts:127-133`) | throws `JsonParseError` (`file-adapter.ts:158-166`) | `install-ide-config-use-case.ts:147`, `install-runtime-config-use-case.ts:232`, `install-ide-tool-use-case.ts:87`, `restore-merge-files-use-case.ts:134` | fixed by phase 2 |
| V2 | merge of two arrays | the incoming array replaces (`:227-243`) | concatenated, deduplicated by JSON value (`:216-219`) | same | fixed by phase 2 |
| V3 | merge of `__proto__`, `constructor`, `prototype` keys | copied (no guard) | skipped (`:204,213`) | same | fixed by phase 2 |
| V4 | `listDirectory` of a missing directory | `[]` (`:72-82`) | rejects `ENOENT` (`readdir`, `:91`) | `purge-declared-cache.ts:62-65`, `clean-user-scope-use-case.ts:190-193,470-473` branch on `ENOENT` | fix |
| V5 | `fileExists` of a directory made by `createDirectory` and still empty | `false`: `createDirectory` is a no-op (`:50-52`) | `true` | `global-plugin-files.ts:62-63` creates the boundary then resolves it; `marketplace-build-strategy.ts:34-39`, `ensure-built-marketplace-use-case.ts:182` | fix (the double tracks directories) |
| V6 | `deleteEmptyDirectories` | no-op (`:54-56`) | removes the empty chain upwards (`:53-74`) | 26 `deleteEmptyDirectories`/`deleteDirectory` call sites in `src` | fix with V5 |
| V17 | a directory after its last file is deleted | gone: directories exist only as file-key prefixes, so `fileExists` turns false and, once V4 is fixed, `listDirectory` rejects | stays: `writeFile` made it with `mkdir -p` (`file-adapter.ts:36`), `deleteFile` removes only the file, so `fileExists` is true and `listDirectory` answers `[]` | `clean-use-case.ts:295-297` lists `aiddDir` after removing its files and deletes it when empty | fix with V5, before V4 |
| V7 | `realpath` of a missing path | returns the path (`:112`) | rejects `ENOENT`, as the port promises (`file-reader.ts:23-24`) | `project-path-boundary.ts:19-27`, `user-scope-plugin-files.ts:126-131`, `global-plugin-files.ts:92`, `purge-declared-cache.ts:77`, `host-marketplace-source-conflict.ts:44` | fix, needs V5 |
| V8 | `realpath` of a path with `..` and no symlink | returned unresolved (`:112`) | resolved | the port names a corrupted manifest entry's `..` (`file-reader.ts:21-23`); `user-scope-plugin-files.ts:128` | fix |
| V9 | `listFilesRecursive` separators on Windows | `/` keys (`:160-170`) | native, built by `join` (`file-adapter.ts:142`) | `built-tree-materialization-translator.ts:172,244`, `plugin-add-use-case.ts:328`, `ensure-built-marketplace-use-case.ts:191`, `list-installed-rules-use-case.ts:60` | decided by the Windows CI run (D9) |
| V10 | `isExecutable` of an existing file | always `false`: the `executable` set is never filled, and the `chmodExecutable` its comment names does not exist (`:16-25`) | `access(X_OK)`; on Windows `X_OK` behaves as `F_OK`, so `true` | none: no `src` code calls `FileReader.isExecutable` (grep) | limit; dead set removed |
| V11 | `readFile` of a directory | `ENOENT` | `EISDIR` | none found | limit |
| V12 | `writeFile` under a parent that is a file | succeeds | rejects `ENOTDIR` | none found | limit |
| V13 | `readFile` or `fileExists` through a symlink | not followed (`setSymlink` only feeds `realpath`, `:118-120`) | followed | none found | limit |
| V14 | path spelling (`./`, `//`, trailing `/`) | keyed after `\` to `/` only (`:197-199`) | resolved by the OS | none found | limit |
| V15 | error shape | `Error` with `code` and a message (`:62-66`) | `ErrnoException` with `code`, `errno`, `syscall`, `path` | product reads `.code` only (every catch cited above) | the suite asserts `code` only |
| V16 | listing order | insertion order | `readdir` order, filesystem-defined | none relies on it found | the suite asserts sets; order stated unspecified |

## Phases

| #   | Phase | Model | Depends on |
| --- | ----- | ----- | ---------- |
| 1   | Baseline capture | haiku | none |
| 2   | Merge leaves the double | sonnet | 1 |
| 3   | Contract level and suite | sonnet | 1 |
| 4   | Fix the double, one divergence at a time | sonnet | 2, 3 |
| 5   | Delete what the suite covers | sonnet | 4 |
| 6   | Docs, memory and rules | sonnet | 5 |
| 7   | Gates and final acceptance | haiku | 6 |

Phases 2 and 3 touch disjoint files and may run in parallel: phase 2 edits `src/kernel/merge.ts`, `file-adapter.ts`, the double and the merge tests; phase 3 edits the configs, the sequencer, one arch test, the workflow and creates the suite. Phases 4 to 7 are serial: 4 and 5 both edit the double's tests and the real adapter's tests.

### Phase 1: Baseline capture (haiku)

> Freeze what runs today, so later phases prove what moved, what left and what stayed green.

Files touched: none in the tree. Writes only to `$B`.

Tasks:

1. `git status --porcelain` lists nothing but this plan.
2. `B="${TMPDIR:-/tmp}/aidd-pr5-baseline"; mkdir -p "$B"; cd cli && pnpm exec vitest list --json="$B/before.json"`.
3. `cd cli && grep -rl InMemoryFileAdapter tests | grep '\.test\.ts$' | sort > "$B/fake-importers.txt"`.
4. `cd cli && pnpm test`.

Acceptance:

| Command | Expected |
| --- | --- |
| `wc -l < "$B/fake-importers.txt"` | `113` |
| `node -e 'const a=require(process.argv[1]);const c={};for(const t of a)c[t.projectName]=(c[t.projectName]\|\|0)+1;console.log(a.length,JSON.stringify(c))' "$B/before.json"` | one total, five keys (`unit`, `integration`, `e2e`, `golden`, `architecture`), no `contract` |
| `cd cli && grep -cE '^\s*it(\.skipIf)?\(' tests/runtime/filesystem/file-adapter.integration.test.ts tests/runtime/filesystem/file-adapter-edges.integration.test.ts` | `34` and `12` (the `it.skipIf` at `edges:78` counts; output is `file:count`) |
| `cd cli && pnpm test` | exit 0, no failed test |

### Phase 2: Merge leaves the double (sonnet)

> The JSON merge is product code that both adapters call; the double stores bytes, and the three merge divergences each fail on the double before they are fixed.

Architecture projection:

```txt
cli/
├── src/kernel/merge.ts                                        ✏️ gains mergeIntoJsonFile(files, path, content, strategy) and its private helpers
├── src/runtime/filesystem/file-adapter.ts                     ✏️ mergeJsonFile delegates; mergePerKey, deepMerge, isPlainObject, PROTOTYPE_POLLUTION_KEYS leave
└── tests/
    ├── helpers/ports/in-memory-file-adapter.ts                ✏️ mergeJsonFile delegates; mergePerKey, deepMerge, isPlainObject leave (about 60 lines)
    ├── kernel/merge-into-json-file.unit.test.ts               ✅ the 23 merge cases, moved, run on the double
    └── runtime/filesystem/
        ├── file-adapter.integration.test.ts                   ✏️ the 18 mergeJsonFile cases leave (lines 158-371)
        └── file-adapter-edges.integration.test.ts             ✏️ the 5 mergeJsonFile cases leave (lines 95-141)
```

Tasks:

1. Create `tests/kernel/merge-into-json-file.unit.test.ts` holding the 23 cases of `file-adapter.integration.test.ts:159-361` and `file-adapter-edges.integration.test.ts:96-133`, same `describe` and `it` names, rewritten to seed and read an `InMemoryFileAdapter` instead of a temp dir, and still calling `fs.mergeJsonFile`. Keep each moved case's full name, as `vitest list` prints it, byte-identical (outer `describe` included): phase 7 matches moved tests by name.
2. Run it red: `cd cli && pnpm exec vitest run tests/kernel/merge-into-json-file.unit.test.ts`. Record the failing case names in the PR description as V1 to V3 evidence. Expected among them: "refuses to merge into a file it cannot parse, naming the file" (V1), "deduplicates merged arrays" and "deduplicates merged arrays of objects by value" (V2); a prototype-key case (V3) is expected for `constructor`, which the double copies as an own key. A case that passes on the double is not a divergence; one that fails for another reason is a rewrite mistake, fixed in the test.
3. In `src/kernel/merge.ts` (no new file, decision D3), add `mergeIntoJsonFile(files: FileReader & FileWriter, path, content, strategy)`: read through `files.readFile`; `ENOENT` means `{}`; any other read error, or a parse error of the existing text, throws `JsonParseError(path, message)`, exactly as `file-adapter.ts:158-166` does; parse the incoming `content` with `stripJsonComments` and leave its `SyntaxError` unwrapped, as `file-adapter.ts:168` does; merge with the per-key or deep strategy; write through `files.writeFile` with `JSON.stringify(_, null, 2)`. Move `mergePerKey`, `deepMerge` (array union, prototype guard) and `isPlainObject` from `file-adapter.ts:184-235` unchanged, comments included.
4. `FileAdapter.mergeJsonFile` and `InMemoryFileAdapter.mergeJsonFile` become one line each: `return mergeIntoJsonFile(this, path, content, strategy);`. Drop the imports nothing uses any more (`stripJsonComments`, `isPerKeyMergeStrategy`, `PerKeyMergeStrategy`, `JsonParseError` where unused).
5. Run the new file: green. Run the 113 importers: `cd cli && pnpm exec vitest run $(cat "$B/fake-importers.txt")`. Classify every red file per decision D7 and list it in the PR description; the 9 files that merge through the double (`restore-use-case`, `restore-all-use-case`, `install-ide-config-use-case`, `install-runtime-config-use-case`, `install-ide-tool-use-case`, `apply-plugin-files-built-tree`, `apply-plugin-files-mode-a-marketplace`, `restore-tool-files-use-case`, `restore-merge-files-use-case`, all `.unit.test.ts`) are the expected ones.
6. Delete the moved cases from the two integration files.
7. `tests/architecture/catches-that-swallow.arch.test.ts:37-40` lists the double's empty catch with the reason "a merge over invalid JSON overwrites, as the real adapter does", which V1 shows false; that catch leaves with the merge, so remove the entry (the ratchet's "fixed" check fails otherwise). The `file-adapter.ts` entry (`:25-28`, the `deleteFile` catch) stays at count 1.

Acceptance:

| Command | Expected |
| --- | --- |
| Task 2 run, before task 3 | at least one failure, each in a case about an unparsable file, arrays or prototype keys |
| `cd cli && pnpm exec vitest run tests/kernel/merge-into-json-file.unit.test.ts` | exit 0, `23 passed` |
| `cd cli && grep -cE 'function (deepMerge\|mergePerKey\|isPlainObject)' tests/helpers/ports/in-memory-file-adapter.ts src/runtime/filesystem/file-adapter.ts` | `0` and `0` |
| `cd cli && wc -l < tests/helpers/ports/in-memory-file-adapter.ts` | 195 or fewer (from 247) |
| `cd cli && pnpm exec vitest run $(cat "$B/fake-importers.txt")` | exit 0, after the D7 classification |
| `cd cli && pnpm test:unit && pnpm test:integration && pnpm test:arch && pnpm typecheck && pnpm lint` | exit 0 each |
| `git diff --stat -- cli/src` | only `kernel/merge.ts` and `runtime/filesystem/file-adapter.ts` |

### Phase 3: Contract level and suite (sonnet)

> A sixth vitest project selects `*.contract.test.ts`, runs under mutation between unit and integration, runs on Windows, and the suite states the port's contract with every case green on the real adapter.

Architecture projection:

```txt
cli/
├── vitest.config.ts                                           ✏️ project "contract"
├── vitest.mutation.config.ts                                  ✏️ project "contract"
├── package.json                                               ✏️ "test:contract"
└── tests/
    ├── helpers/ports/file-port-contract.ts                    ✅ describeFileContract(subjectName, makeSubject)
    ├── helpers/mutation-sequencer.ts                          ✏️ PROJECT_ORDER = ["unit", "contract", "integration"]
    ├── helpers/mutation-sequencer.integration.test.ts         ✏️ one case: contract after unit, before integration
    ├── architecture/throwaway-profile-wiring.arch.test.ts     ✏️ RUNS_SOURCE and expectation gain "contract"
    └── runtime/filesystem/file-adapter.contract.test.ts       ✅ calls the suite twice
.github/workflows/cli-ci.yml                                   ✏️ Windows job: "pnpm test:contract" step
```

Tasks:

1. Sequencer first (red): add a case to `mutation-sequencer.integration.test.ts` asserting a `contract` spec sorts after a `unit` one and before an `integration` one of smaller size; run it, watch it fail; set `PROJECT_ORDER` (`mutation-sequencer.ts:5`); green. Update the comment at `:17` ("unit, then contract, then integration").
2. Arch test first (red): in `throwaway-profile-wiring.arch.test.ts:6,26`, `RUNS_SOURCE` and the expected names become `["contract", "integration", "unit"]` (sorted); run `pnpm test:arch`, watch it fail for the missing project.
3. `cli/vitest.config.ts`: a project after `unit`, a copy of the unit block with `name: "contract"`, `include: ["tests/**/*.contract.test.ts"]`, the same two `globalSetup` entries. `cli/vitest.mutation.config.ts`: the same block after its `unit` project, with `globalSetup: ["./tests/helpers/throwaway-profile.ts"]`. The arch test of task 2 goes green.
4. `cli/package.json`: `"test:contract": "vitest run --project=contract"` after `test:unit`.
5. `.github/workflows/cli-ci.yml`, Windows job, after `- run: cd cli && pnpm test:integration` (line 566): `- run: cd cli && pnpm test:contract`. Its own step, no `--max-workers`: the cap's reason (`cli-ci.yml:570-574`) is the e2e build's module transform, which this project does not load.
6. `tests/helpers/ports/file-port-contract.ts`: `export function describeFileContract(subjectName: string, makeSubject: () => Promise<FileSubject>)`, where `FileSubject` is `{ files: FileReader & FileWriter; root: string; hasher: Hasher; link(target: string, path: string): Promise<void>; dispose(): Promise<void> }`. Every case builds paths with `join(subject.root, ...)`, never a literal separator. The outer `describe` reads `when the file port is ${subjectName}`; each `it` names an observable result. No `node:fs` import here: the real subject's I/O lives in the test file.
7. `tests/runtime/filesystem/file-adapter.contract.test.ts` calls it twice:
   - `"the in-memory double"`: `root` is `join(sep, "contract-root")`; `files` is `new InMemoryFileAdapter({}, hasher)`; `link` is `setSymlink(path, target)`; `dispose` does nothing.
   - `"the real adapter on a temp dir"`: `root = await realpath(await mkdtemp(join(tmpdir(), "aidd-file-contract-")))`, resolved because macOS serves `/var` as `/private/var` and Windows runners hand out 8.3 temp names; `files` is `new FileAdapter(hasher)`; `link` is `symlink(target, path, "dir")` from `node:fs/promises`; `dispose` removes `root`.
   - Both subjects take the same `new HasherAdapter()`.
8. The cases, one `it` each, inputs of one behaviour in one `it.each` at most:

| Case | Behaviour stated | Divergence it probes |
| --- | --- | --- |
| C1 | reads back exactly what was written, for LF, CRLF, multibyte UTF-8 and a leading BOM | none |
| C2 | writing creates every missing parent | none |
| C3 | writing over a file replaces all of it, a shorter content leaving no tail | none |
| C4 | a write leaves only the file in its directory | none |
| C5 | reading a missing file rejects with code `ENOENT` | V15 (code only) |
| C6 | a file's hash is the hasher's hash of its content | none |
| C7 | a written file and a directory holding one exist; a missing path does not | none |
| C8 | a created directory exists while still empty | V5 |
| C9 | deleting a file removes it; deleting a missing file resolves | none |
| C10 | deleting a directory removes its tree; deleting a missing one resolves | none |
| C11 | removing empty directories climbs to the first non-empty parent; a missing start resolves | V6 |
| C12 | listing a directory answers every file below it, relative and `/`-separated, as a set | V16 |
| C13 | listing a missing directory rejects with code `ENOENT` | V4 |
| C14 | listing recursively answers absolute paths equal to `join(root, ...)`, as a set; a missing directory answers `[]` | V9, V16 |
| C15 | both listings skip a symlinked directory | none |
| C16 | the real path of a file equals the real path of the same file reached through its parent's real path | none |
| C17 | `realpath(join(link, "x"))` equals `realpath(join(target, "x"))` for a symlinked directory | none |
| C18 | the real path of `a/../b` is the real path of `b` | V8 |
| C19 | the real path of a missing path rejects with code `ENOENT` | V7 |
| C20 | a missing path is not executable | V10 (the existing-file case is a limit) |
| C21 | a directory stays, empty and listable, after its last file is deleted | V17 |

9. Run `cd cli && pnpm test:contract`. A case red on the real adapter is a wrong case: fix the case, never `FileAdapter` (decision D5). Then record the cases red on the double: those are phase 4's input. Expected: C8, C11, C13, C18, C19, C21; C14 only on Windows. C16, C17 and C18 compare `realpath` outputs with each other, never with a `join(...)` literal: the double answers `/` spelling on Windows on purpose (`realpath-windows.unit.test.ts:22-26`), and product code only compares real paths with each other (`project-path-boundary.ts:15-20`).
10. Inverted proof for each case green on both, since it starts green (relevance rule's characterization exception): break the behaviour in `FileAdapter` by hand, watch that case go red on the real subject, revert, `git diff --quiet -- cli/src`. The breaks are the ones of phase 5's table; a case no break turns red is dropped.

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm exec vitest run tests/helpers/mutation-sequencer.integration.test.ts` | exit 0, the new case among the passed (it failed before task 1's edit) |
| `cd cli && pnpm test:arch` | exit 0 (it failed after task 2, before task 3) |
| `cd cli && pnpm exec vitest run --project=contract -t 'the real adapter'` | exit 0, every case passed |
| `cd cli && pnpm exec vitest run --project=contract -t 'the in-memory double'` | fails, only on cases listed in task 9 |
| `cd cli && pnpm exec vitest list --project=contract --json="$B/contract.json"` and a count by subject | the same case names under both subjects |
| `cd cli && pnpm exec vitest list --config vitest.mutation.config.ts --project=contract` | lists the contract file |
| `cd cli && pnpm lint && pnpm typecheck && pnpm knip` | exit 0 each |

### Phase 4: Fix the double, one divergence at a time (sonnet)

> The double passes the whole suite; each fix was a case red on the double first, and each fallout in the 113 importers is classified, never silenced.

Architecture projection:

```txt
cli/tests/helpers/ports/
├── in-memory-file-adapter.ts                 ✏️ tracks directories; realpath resolves `..` and rejects a missing path; listDirectory rejects a missing directory; dead executable set removed
└── realpath-windows.unit.test.ts             ✏️ the identity case seeds the file it resolves
cli/tests/**                                  ✏️ only seeds of importers classified "incomplete seed" (D7)
```

Tasks, in this order, one divergence per step; after each step run the double's subject and the 113 importers:

1. V5, V6 and V17: a `directories` set. Every way a file enters the double registers its ancestor directories (constructor seed, `writeFile`, `setFile`, hence `seedFromDirectory`); `createDirectory` adds the path and its ancestors; `fileExists` answers true for it; `deleteDirectory` drops it and everything under it; `deleteEmptyDirectories` removes the path and each ancestor while it holds no file and no other directory, stopping at the first non-empty one; `deleteFile` leaves directories alone (the real adapter does). C8, C11 and C21 go green. This step lands before V4, or V4 would reject listings of a directory the real adapter still has.
2. V4: `listDirectory` rejects with an `ENOENT` error built like `readFile`'s (`:62-66`) when the path is neither a file prefix nor a known directory. C13 goes green.
3. V8: `realpath` resolves `.` and `..` with `posix.normalize` on the `/`-normalized path before matching symlinks, never `resolve` when nothing matches, so a virtual `/project/file` stays drive-free on Windows (`realpath-windows.unit.test.ts:22-26` is that guarantee). C18 goes green.
4. V7: `realpath` rejects with `ENOENT` when the resolved path is neither a file, an implicit directory, nor a known directory. C19 goes green. `realpath-windows.unit.test.ts:22-26` seeds `/project/file` before resolving it; its title stays.
5. V10: remove the never-filled `executable` set and its comment; `isExecutable` answers `false`. Limit stated in phase 6.
6. V9 is not touched here: it shows only on Windows (D9).

Fallout rule for every step (decision D7): a red importer file is read before anything changes.

- Incomplete seed: the test never created a directory or file the real adapter would need for the state it describes (a project root with no file, a symlink target that is never seeded). Fix the seed only; the assertion stays.
- Encoded falsehood: the assertion describes an outcome the product would not show on a real filesystem. That is a product bug candidate: product untouched, the case recorded in the PR description, the step escalated.
- Budget: more than 10 red importer files for one step stops that step. Revert the fake edit, keep its contract case red, report the list to the caller. Never mark a contract case `.fails` or `.skip` to land it.

Acceptance:

| Command | Expected |
| --- | --- |
| Before each step, `cd cli && pnpm exec vitest run --project=contract -t 'the in-memory double'` | the step's case red |
| After each step, the same command | that case green, no other newly red |
| After each step, `cd cli && pnpm exec vitest run $(cat "$B/fake-importers.txt")` | exit 0, after D7 classification |
| `cd cli && pnpm test:contract` | exit 0, every case passed on both subjects |
| `cd cli && pnpm exec vitest run tests/helpers/ports/realpath-windows.unit.test.ts` | exit 0 |
| `git diff --stat -- cli/src` | unchanged since phase 2 |
| `git diff -- cli/tests ':!cli/tests/helpers' ':!cli/tests/kernel' ':!cli/tests/runtime/filesystem' \| grep -E '^[-+]\s*expect\('` | no output: importers changed only their seeds |

### Phase 5: Delete what the suite covers (sonnet)

> Each real-adapter test the suite now states is deleted after an inverted proof; what the port cannot observe stays as integration.

Architecture projection:

```txt
cli/tests/runtime/filesystem/
├── file-adapter.integration.test.ts          ✏️ keeps the atomic rename case and absorbs the 4 kept edge cases
└── file-adapter-edges.integration.test.ts    ❌ its cases deleted, moved (phase 2) or absorbed
```

Procedure per row: apply the break to `cli/src/runtime/filesystem/file-adapter.ts`, run `cd cli && pnpm exec vitest run tests/runtime/filesystem`, see the named contract case and the old test both red, revert, `git diff --quiet -- cli/src`, delete the old test. A row where the contract case stays green keeps its old test and is reported.

| Old test (deleted) | Break in `FileAdapter` | Covering case |
| --- | --- | --- |
| `file-adapter.integration.test.ts:28` writes file content | `readFile` returns `""` | C1 |
| `:60` reads and provides file content as string | same | C1 |
| `:35` creates parent directories recursively | drop the `mkdir` in `writeFile` | C2 |
| `:69` removes an existing file | `deleteFile` does nothing | C9 |
| `:76` handles missing file gracefully | `rm` without `force` and without the catch | C9 |
| `:83` creates directory recursively | `createDirectory` does nothing | C8 |
| `:91` removes empty directory | `deleteEmptyDirectories` returns at once | C11 |
| `:98` removes chain of empty directories | stop after the first `rmdir` | C11 |
| `:105` stops when directory is not empty | drop the `entries.length > 0` break | C11 |
| `:119` lists all files recursively with relative paths | push `entry.name` instead of `posixRelative` | C12 |
| `:134` confirms an existing file is found | `fileExists` returns `false` | C7 |
| `:140` confirms a missing file is not found | `fileExists` returns `true` | C7 |
| `:144` confirms an existing directory is found | `fileExists` uses `stat(...).isFile()` | C7 |
| `:150` returns hash of file content | `readFileHash` hashes `""` | C6 |
| `:374` skips symbolic links and does not read their content | drop the `isSymbolicLink` skip in `collectFiles` | C15 |
| `file-adapter-edges.integration.test.ts:26` lists every file below the directory by absolute path | push `entry.name` in `collectAbsolutePaths` | C14 |
| `edges:37` answers nothing for a directory that is not there | drop the `readdir` catch in `collectAbsolutePaths` | C14 |
| `edges:73` copes with a directory that is not there | drop the first catch in `deleteEmptyDirectories` | C11 |

Count: 18 deleted, 23 moved to unit (phase 2), 5 kept as integration. Kept, because the port does not expose what they check: `:44` writes through a temporary file and renames it into place (`vi.mock` of `rename`), `edges:41` and `edges:62` the logger's "Skipping symlink" message (the logger is a constructor argument), `edges:51` the same skip with no logger, `edges:78` the stop at a read-only directory (`chmod`, POSIX, non-root). The four edge cases move into `file-adapter.integration.test.ts`, which then holds 5 cases; `file-adapter-edges.integration.test.ts` is deleted.

Acceptance:

| Command | Expected |
| --- | --- |
| Each row's break | the covering case and the old test red, then green after revert |
| `cd cli && grep -cE '^\s*it(\.skipIf)?\(' tests/runtime/filesystem/file-adapter.integration.test.ts` | `5` |
| `test ! -e cli/tests/runtime/filesystem/file-adapter-edges.integration.test.ts` | exit 0 |
| `cd cli && pnpm test:integration && pnpm test:contract` | exit 0 each |
| `git diff --quiet -- cli/src/runtime/filesystem/file-adapter.ts && git diff --stat HEAD -- cli/src/runtime/filesystem/file-adapter.ts` | only phase 2's delegation |

### Phase 6: Docs, memory and rules (sonnet)

> Every list of levels names `contract`, the one home of the detail says what a contract suite is, and the limits are written where the double is described.

Architecture projection:

```txt
aidd_docs/memory/testing.md                          ✏️ :13 "six projects"
cli/
├── ARCHITECTURE.md                                  ✏️ Tests table: *.contract.test.ts row
├── aidd_docs/memory/testing.md                      ✏️ six projects, contract level, file double limits, run line
└── .claude/
    ├── rules/01-standards/1-conventions.md          ✏️ :29 tier list gains *.contract.test.ts
    └── skills/test/SKILL.md                         ✏️ :14 "six vitest projects"
```

Tasks:

1. `cli/aidd_docs/memory/testing.md`, the one home for the detail:
   - Strategy: six projects; `contract` selects `*.contract.test.ts` anywhere under `tests/` and runs under mutation between unit and integration. Contract: one suite per port, a `describe<Port>Contract(subjectName, makeSubject)` in the doubles' kit, called by one `.contract.test.ts` with the double and with the real adapter; a case red on the real adapter is a wrong case, one red on the double is a divergence fixed in the double.
   - Conventions, the doubles line: `InMemoryFileAdapter` passes `describeFileContract` (`tests/helpers/ports/file-port-contract.ts`, run by `tests/runtime/filesystem/file-adapter.contract.test.ts`); it stores text and delegates merging to `mergeIntoJsonFile` in `src/kernel/merge.ts`.
   - The limits, stated as such: listing order is unspecified on both; errors carry `code` only on the double; the double reads no file through a symlink, accepts a write under a file, answers `ENOENT` for a directory read, keys paths without resolving `./`, `//` or a trailing `/`, and never reports a file executable; `isExecutable` has no product caller. Plus V9's outcome from the Windows run.
   - Run: add `test:contract`.
2. `aidd_docs/memory/testing.md:13`: `vitest, six projects, see the CLI bank`. No detail here: `scripts/check-doc-duplication.js` fails on a 12-word sentence shared by the two banks.
3. `cli/ARCHITECTURE.md:138-145`: row `*.contract.test.ts` with "One port's suite, run against its double and its real adapter".
4. `cli/.claude/rules/01-standards/1-conventions.md:29`: insert `*.contract.test.ts` after `*.unit.test.ts`.
5. `cli/.claude/skills/test/SKILL.md:14`: "six vitest projects".
6. `grep -rniE 'five (vitest )?projects' cli/.claude cli/aidd_docs/memory aidd_docs/memory cli/ARCHITECTURE.md` returns nothing.

Acceptance:

| Command | Expected |
| --- | --- |
| `node scripts/check-doc-duplication.js` | exit 0 |
| `node scripts/check-referenced-paths.js` | exit 0 |
| `node scripts/check-markdown-links.js --ignore cli/tests/fixtures --ignore cli/aidd_docs/tasks` | exit 0 |
| `node scripts/check-no-local-paths.js aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/*.md` | exit 0 |
| `cd cli && pnpm test:arch` | exit 0 (`referenced-paths` resolves every cited path) |
| task 6 grep | no output |

### Phase 7: Gates and final acceptance (haiku)

> Every gate green, the suite runs the same tests minus the 18 deleted, plus the contract cases and the sequencer case, and mutation still holds on what moved.

Files touched: none. On a failure, one agent per failing assertion, per `coding-assertions.md`.

Tasks:

1. `pnpm exec lefthook run pre-commit --all-files`, then `pnpm exec lefthook run pre-push --all-files`.
2. `cd cli && pnpm test`, then `pnpm exec vitest list --json="$B/after.json"`.
3. Compare by test name, file ignored for the 23 moved cases:

```sh
node -e '
const [before, after] = process.argv.slice(1).map((p) => require(p));
const rel = (f) => f.replace(/.*\/cli\//, "");
const key = (t) => `${rel(t.file)}|${t.name}`;
const b = new Set(before.map(key)), a = new Set(after.map(key));
const missing = [...b].filter((k) => !a.has(k));
const added = [...a].filter((k) => !b.has(k));
const movedNames = new Set(after.filter((t) => rel(t.file) === "tests/kernel/merge-into-json-file.unit.test.ts").map((t) => t.name));
console.log(JSON.stringify({
  before: before.length, after: after.length,
  missingNotMoved: missing.filter((k) => !movedNames.has(k.split("|")[1])).length,
  movedFound: missing.filter((k) => movedNames.has(k.split("|")[1])).length,
  addedFiles: [...new Set(added.map((k) => k.split("|")[0]))].sort(),
  contract: after.filter((t) => t.projectName === "contract").length }, null, 1));
' "$B/before.json" "$B/after.json"
```

4. Mutation on the changed lines: `cd cli && node scripts/run-mutation.mjs --changed test/test-levels-and-guards`. It diffs the merge base against the working tree (`run-mutation.mjs:204-205`, `git diff <merge-base> -- src`), so the uncommitted change is what it mutates. The moved merge now sits in scope `kernel` (break 95) instead of `runtime` (break 90).

Acceptance:

| Command | Expected |
| --- | --- |
| both lefthook runs | exit 0 |
| `cd cli && pnpm test` | exit 0 |
| the comparison | `missingNotMoved: 22`: the 18 of phase 5's table plus the 4 absorbed edge cases, whose names reappear under `file-adapter.integration.test.ts`; `movedFound: 23`; `addedFiles` is exactly the merge unit file, the contract file, the sequencer test and `tests/runtime/filesystem/file-adapter.integration.test.ts` (the 4 absorbed cases); `contract` is twice the number of cases (21 per subject, or fewer if phase 3 task 10 dropped one) |
| `run-mutation.mjs --changed` | no survivor in `src/kernel/merge.ts` or `src/runtime/filesystem/file-adapter.ts`, or each survivor named with the assertion it lacks |
| `cd cli && wc -l < "$B/fake-importers.txt"; pnpm exec vitest run $(cat "$B/fake-importers.txt")` | `113`, exit 0 |
| After push, the PR's `cli / Windows` job | the `pnpm test:contract` step green; a red C14 on the double is V9 (D9) |
| `git status --porcelain` | the files of phases 2 to 6 and this plan; nothing committed |

## Resources

| Source | Verified |
| ------ | -------- |
| <https://nodejs.org/api/fs.html#file-access-constants> | `X_OK` has no effect on Windows and behaves as `F_OK`: the real adapter calls any existing file executable there (V10) |
| <https://nodejs.org/api/fs.html#fspromisessymlinktarget-path-type> | `type` (`"dir"`, `"junction"`) only matters on Windows; the real subject passes `"dir"` for a directory link |

## Decisions

| Decision | Why |
| -------- | --- |
| D1. One file at the requested path, phases inline, instead of the skill's `plan.md` and `phase-<n>.md` | The caller fixed the path; the folder already holds `plan-pr1-test-levels-and-guards.md` and later PR plans would collide on generic names. No `backlog-link.json`: the source names no ticket. |
| D2. The suite is `describeFileContract(subjectName, makeSubject)` in `tests/helpers/ports/file-port-contract.ts`; one test file, `tests/runtime/filesystem/file-adapter.contract.test.ts`, calls it with the double and with the real adapter | Doc 07 section 2.3 puts the suite in the kit that owns the double; today that kit is `tests/helpers/ports/` (doc 07 section 8 row), and it moves to `tests/shared/testing/` with step 10. The test file mirrors the real module it proves (`src/runtime/filesystem/file-adapter.ts`), sits beside the tests it replaces, and moves with that adapter. `knip.json:2-3` takes the test as an entry and ignores `tests/helpers/**`. |
| D3. The merge goes into the existing `src/kernel/merge.ts` as `mergeIntoJsonFile(files, path, content, strategy)`, called by both adapters | `src/kernel` holds 10 direct `.ts` files and `folder-size.arch.test.ts:8` caps a folder at 10, so a new file there fails the ratchet. `merge.ts` already owns `MergeStrategy` and the per-key type (`:5-15`) and already takes a port (`Hasher`, `:2`). Taking `FileReader & FileWriter` keeps the error mapping in one place, byte for byte (`file-adapter.ts:158-166`). The double then stores text only, as doc 07 sections 2.3 and 8 require. |
| D4. No `FileMerger` contract suite | After D3 both implementations run the same function; a suite would run one piece of code twice. The merge is proven once, at unit level, on the double the file contract verifies; the one-line delegation in `FileAdapter` is left to phase 7's changed-lines mutation run. |
| D5. A case red on the real adapter is a wrong case, never a reason to change `FileAdapter` | The contract: no product behaviour change, the double follows the adapter, never the reverse. |
| D6. A divergence earns a fake fix only when product code sends that input; otherwise it is a written limit | `aidd_docs/memory/coding-assertions.md`, "Before the code": write no code for an input never observed. Each fixed divergence above cites its caller; V10 to V14 have none found. |
| D7. Fallout in the 113 importers is classified (incomplete seed, encoded falsehood) with a budget of 10 red files per step | A test that breaks when the double stops lying relied on the lie. Fixing its seed keeps its assertion; an assertion the real filesystem could not satisfy is a product bug candidate the contract forbids fixing here. The budget bounds V7, whose blast radius is unmeasured: 21 test files call `setSymlink` and an unseeded project root was legal until now. |
| D8. The `contract` project runs under mutation, ordered after `unit` and before `integration` | Deleting 18 real-adapter tests removes killers of `src/runtime/filesystem/**` (scope `runtime`, break 90, `mutation-scopes.json`); only a project in `vitest.mutation.config.ts:36-61` can replace them. The double's cases are millisecond-fast like unit; the real subject's are temp-dir fast, so the order follows cost (`mutation-sequencer.ts:16-25`). `throwaway-profile-wiring.arch.test.ts:6` must then name it, since the project runs source. Consequence: this PR edits `cli/tests/helpers/`, `vitest.mutation.config.ts`, `package.json` and `cli-ci.yml`, all in `mutation-scopes-to-run.mjs:9-25`'s full-matrix set, so every scope runs on it and every floor gates. |
| D9. The contract runs on Windows as its own step; V9 is settled by that run | The real adapter is platform-sensitive: `join` separators (`file-adapter.ts:142`), `realpath` drive letters (`realpath-windows.unit.test.ts:6-12` mocks exactly that), symlink types. The Windows job runs `test:unit`, `test:integration`, `test:arch` as separate steps (`cli-ci.yml:565-567`), so a project not named there never runs on Windows. Nothing here runs Windows locally; C14 is the only case expected red there (C16 to C18 are relational, D10); if it is red on the double, the fix is `join(dirPath, rel)` in `listFilesRecursive`, under D7's budget, in a follow-up commit on the same branch. macOS runs no CLI suite in CI (`cli-ci.yml`, `macos` job); local runs on darwin cover `/private/var`. |
| D10. Assertions compare sets and `code`, and build paths with `join(subject.root, ...)` | The port promises `/` in `listDirectory` only (`file-reader.ts:5-8`); order is unspecified and no caller relying on it was found; product catches read `.code` only. Asserting more would pin accidents of one subject. `realpath` results are compared with each other, never with a built literal, since the double keeps a drive-free `/` spelling on Windows by design (`realpath-windows.unit.test.ts:22-26`). |
| D11. Contract cases start green on both subjects for most behaviours and are kept under the characterization exception, each with an inverted proof | `07-test-architecture.md` section 1 and `coding-assertions.md`: a green-first test is kept only with a proof that breaking the behaviour turns it red. Phase 3 task 10 and phase 5's table give that proof, case by case. |

## Unrelated, noted

- `FileReader.isExecutable` has no product caller (`grep -rn 'isExecutable(' cli/src`); a separate change can drop it from the port and both adapters.
