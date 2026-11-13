import assert from "node:assert/strict";
import { test } from "vitest";
import {
  headingAnchors,
  normalizedAnchor,
} from "../../../../src/contexts/recipes/domain/markdown-scan.js";

test("heading anchors preserve Unicode and visible formatting text, with duplicate suffixes", () => {
  assert.deepEqual(
    [
      ...headingAnchors(
        "# **Café** `Ready`\n## Café Ready\n## Café Ready\n## **Under**-dash\n<!-- # Hidden -->\n```text\n# Fenced\n```"
      ),
    ],
    ["café-ready", "café-ready-1", "café-ready-2", "under-dash"]
  );
});

test("anchor normalization handles encoded Unicode, emoji modifiers, and malformed encoding", () => {
  assert.equal(normalizedAnchor("#CAF%C3%89"), "café");
  assert.equal(normalizedAnchor("#READY\u200d\ufe0e\ufe0f"), "ready");
  assert.equal(normalizedAnchor("#BAD%ZZ\u200d\ufe0e\ufe0f"), "bad%zz");
});
