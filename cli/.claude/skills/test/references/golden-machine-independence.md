# Reference: Golden / Snapshot Machine Independence

## Rule

Golden and snapshot tests must be machine-independent. Never snapshot values
that are derived — even indirectly — from absolute paths.

## Symptom

Test passes locally, fails on CI with a different hash or value. The value looks
deterministic (a hex digest, a size, a timestamp) but is actually derived from
path-bearing content that differs between machines.

## Root cause pattern

The production code computes a hash (or any deterministic function) over file
content. The file content includes an absolute path (config entry, marketplace
source URL, tool path). On a different machine the path differs, so the hash
differs, even though the behavior is identical.

The normalize() pass over the snapshot JSON replaces the path string in visible
fields — but the hash was already derived from the pre-normalization bytes and
stored as a plain hex string. normalize() cannot reverse a one-way hash.

## Fix

Normalize the source content BEFORE computing or recording any derived value.
Two acceptable approaches:

1. **Recompute over normalized content (preferred):** At capture time, after
   writing the file, re-read it, run it through the same normalize() function
   used on visible content, then compute the hash from that normalized string.
   Store the normalized hash in the snapshot. The snapshot remains a meaningful
   fingerprint of content shape — a real change still flips the hash — but the
   fingerprint is path-independent.

2. **Placeholder the derived value AND capture normalized content separately:**
   Replace the hash with `<HASH>` and add a normalized-content field so the
   test still detects real content changes.

Approach 1 requires no snapshot shape change and is simpler.

## Proof of machine independence

After regenerating the snapshot:

- grep the snapshot file for `/Users/` and `/home/` — both must be absent.
- Run the "two captures byte-identical" sub-test; it exercises two different
  temp directories on the same machine, catching any remaining non-determinism.

## What to preserve

The hash value still signals a real change. Replacing it with a path-independent
digest does NOT gut the test — it merely makes the baseline stable. Only a
pure `<HASH>` placeholder with no content capture guts the signal.
