import { describe, expect, it } from "vitest";
import {
  HOOKS_MANIFEST,
  hookScripts,
} from "../../../../../src/contexts/translate/domain/rules/hook-scripts.js";

const at = (relativePath: string, content: string) => ({
  relativePath: `out/${relativePath}`,
  content,
});

describe("hookScripts", () => {
  it("places every script and leaves out the plugin's own manifest", () => {
    const files = [
      { relativePath: HOOKS_MANIFEST, content: "{}" },
      { relativePath: "hooks/a.cjs", content: "a" },
    ];

    expect(hookScripts(files, at)).toStrictEqual([
      { relativePath: "out/hooks/a.cjs", content: "a" },
    ]);
  });

  it("takes a hooks.json further down as a script", () => {
    const files = [{ relativePath: "hooks/sub/hooks.json", content: "{}" }];

    expect(hookScripts(files, at).map((file) => file.relativePath)).toStrictEqual([
      "out/hooks/sub/hooks.json",
    ]);
  });

  it("drops a script the layout takes none of", () => {
    expect(hookScripts([{ relativePath: "hooks/a.cjs", content: "a" }], () => null)).toStrictEqual(
      []
    );
  });
});
