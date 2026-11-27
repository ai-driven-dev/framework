# The manifest reads v9 and splits a v8 document on its first save

Read before touching the manifest version, `ManifestFile` or `splitV8Manifest`.

- v9 is the only version written; v8 is the only older version read, and only as v9.
- Why: a v8 manifest carried each tool's host registration inline; refusing it would orphan those registrations.
- Reading a v8 document writes nothing: it is split in memory into tool entries and host registration records.
- Its first save of the manifest or the records writes the records, then the v9 manifest.
- Code: `cli/src/contexts/installation/infrastructure/manifest-file-io.ts`, `cli/src/contexts/installation/domain/manifest/v8-manifest.ts`.
- Each write is atomic and the v8 document stays the records' source until the last one, so a cut-short save leaves the scope as it was.
- Any other version is refused with the fix named.
- A further format change needs its own decision; this one implies no second reader.
