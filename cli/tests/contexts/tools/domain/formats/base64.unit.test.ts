import { describe, expect, it } from "vitest";
import { toBase64 } from "../../../../../src/contexts/tools/domain/formats/base64.js";

const ANTIGRAVITY_HOOK_COMMANDS = [
  "node ./.agents/hooks/aidd-context/update_memory.js",
  "./lint.sh",
  'node "./.agents/hooks/aidd-context/a b.js" --flag="x y"',
];

describe("toBase64()", () => {
  it.each([...ANTIGRAVITY_HOOK_COMMANDS, "", "a", "ab", "abc", "é漢😀", "node ./hooks/é.js"])(
    "matches Buffer's UTF-8 base64 for %j",
    (text) => {
      expect(toBase64(text)).toBe(Buffer.from(text, "utf8").toString("base64"));
    }
  );
});
