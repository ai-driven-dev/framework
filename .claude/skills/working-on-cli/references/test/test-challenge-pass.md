# Test challenge pass

Question: which tests of a context earn their place, and what proves each deletion.

A PR that deletes tests delivers the pass inside the PR. A deletion without its proof is not merged.

1. Run the deterministic pre-filter over the context's tests; it yields candidates, never verdicts.
   - Unique coverage per test file: cover the context's sources with every file, then without each, and compare covered statements and branches in `coverage-final.json`.
   - Run `npx jscpd` on the test files.
   - Find tests with no assertion through `--expect.requireAssertions`.
   - List duplicate titles.
2. Prove each deletion by inversion.
   - Break the named behaviour by hand, see another named test turn red, restore, and write both down.
   - A test deleted with its code names the test that now holds the behaviour, proven the same way.
3. Write the traceability table, one row per test before and after.
   - Columns: file and title, behaviour pinned, pre-filter flags, verdict, target, proof.
4. Write the counts.
   - Tests and lines before and after; kept, rewritten, merged, moved to the kit, deleted with their code, deleted by proof, added.
