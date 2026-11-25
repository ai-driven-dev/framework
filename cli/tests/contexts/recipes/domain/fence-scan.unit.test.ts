import assert from "node:assert/strict";
import { test } from "vitest";
import { scanFences } from "../../../../src/contexts/recipes/domain/fence-scan.js";

type Reported = [number, string];

function scan(content: string) {
  const reported: Reported[] = [];
  const scanned = scanFences(content.split("\n"), (line, rule) => reported.push([line, rule]));
  return { scanned, reported };
}

test("a closed fence is one block whose lines are all fenced", () => {
  const { scanned, reported } = scan("a\n```bash\necho\n```\nb");

  assert.deepEqual([...scanned.fencedLines], [1, 2, 3]);
  assert.deepEqual(
    scanned.blocks.map(({ language, start, end, body }) => [language, start, end, body]),
    [["bash", 1, 3, "echo"]]
  );
  assert.deepEqual(reported, []);
});

test("an opening fence without a language is reported on its line", () => {
  assert.deepEqual(scan("```\nx\n```").reported, [[1, "fence-language"]]);
});

test("a fence that never closes is reported on its opening line", () => {
  assert.deepEqual(scan("a\n```bash\nx").reported, [[2, "fence-balance"]]);
});

test("a shorter or different marker does not close a fence", () => {
  const { scanned } = scan("````bash\n```\n~~~~\n````");

  assert.equal(scanned.blocks.length, 1);
  assert.equal(scanned.blocks[0].end, 3);
});
