# Golden machine independence

A golden or snapshot never holds a value derived, even indirectly, from an absolute path.

## Cause

| Step | What happens |
| --- | --- |
| symptom | green locally, a different hash or value on CI |
| origin | code hashes file content that carries an absolute path (config entry, marketplace source, tool path) |
| why the snapshot misses it | `normalize()` rewrites visible paths, but the hash came from the pre-normalization bytes and is a one-way hex string |

## Fix

- Preferred: write the file, re-read it, run it through the same `normalize()` as visible content, then compute the hash from that string. A real change still flips the hash; the fingerprint is path-independent, and the snapshot shape is unchanged.
- Alternative: replace the hash with `<HASH>` and add a normalized-content field, so a real content change is still detected.
- A bare `<HASH>` with no content capture empties the test.

## Proof

- Grep the snapshot for `/Users/` and `/home/`: both absent.
- The "two captures byte-identical" sub-test passes across two temp directories.
