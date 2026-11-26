# The manifest reads v9 and splits a v8 document once

Read before touching the manifest version, `ManifestFile.load` or `splitV8Manifest`.

- v9 is the only version written; v8 is the only older version read, and only to be split.
- Why: a v8 manifest carried each tool's host registration inline; refusing it would orphan those registrations.
- `load` splits a v8 document on first read into tool entries and host registration records, then writes v9.
- Code: `cli/src/contexts/installation/infrastructure/manifest-file-io.ts`, `cli/src/contexts/installation/domain/manifest/v8-manifest.ts`.
- Each write is atomic and the v8 document stays until the last one, so a cut-short split reruns.
- Any other version is refused with the fix named.
- Limit: the split takes no lock; two processes reading one v8 document write the same files.
- A further format change needs its own decision; this one implies no second reader.
