# The manifest reads v9 and splits a v8 document once

Read when touching the manifest version, `ManifestFile.load` or `splitV8Manifest`.

- Replaces "the manifest reads one version and refuses the rest; no migration chain".
- Why: a v8 manifest carried each tool's host registration inline. Refusing it with "delete the file" would orphan those registrations at the host.
- Now: v9 is the only version written. v8 is the only older version read, and only to be split.
- One step, no chain: `ManifestFile.load` splits a v8 document on its first read into tool entries and the host registration records, writes the records, then the v9 manifest (`contexts/installation/infrastructure/manifest-file-io.ts`, `domain/manifest/v8-manifest.ts`).
- Each write is atomic and the v8 document stays until the last one, so a cut-short split runs again from it.
- Any other version is still refused with the fix named.
- Limit: the split takes no lock. Two processes reading one v8 document at once write the same files from the same document.
- Limit: how many v8 manifests are in circulation is not measured.
- A further format change needs its own decision. A second reader is not implied by this one.
