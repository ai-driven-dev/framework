import { describe, expect, it } from "vitest";
import { JsoncWriter } from "../../../../src/contexts/tools/infrastructure/jsonc-writer.adapter.js";

const writer = new JsoncWriter();

describe("when a config is rewritten over its current text", () => {
  it("keeps the comments around a key it changes and a key it adds", () => {
    const current = '{\n  // theme\n  "theme": "dark", /* end */\n  "mcp": {}\n}\n';

    const next = writer.rewrite(current, {
      theme: "dark",
      mcp: { docs: { type: "local" } },
      extra: 1,
    });

    expect(next).toContain("// theme");
    expect(next).toContain("/* end */");
    expect(JSON.parse(next.replace(/\/\/.*|\/\*.*?\*\//g, ""))).toEqual({
      theme: "dark",
      mcp: { docs: { type: "local" } },
      extra: 1,
    });
  });

  it("drops a key the next content no longer has, leaving the rest", () => {
    const next = writer.rewrite('{\n  // kept\n  "a": 1,\n  "b": 2\n}\n', { a: 1 });

    expect(next).toContain("// kept");
    expect(next).not.toContain('"b"');
  });
});
