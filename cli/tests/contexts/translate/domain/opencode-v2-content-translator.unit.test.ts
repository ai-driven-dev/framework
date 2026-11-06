import { expect, it } from "vitest";
import { opencode } from "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { PluginContentTranslator } from "../../../../src/contexts/translate/domain/content-translator.js";
import { PluginDistribution } from "../../../../src/contexts/translate/domain/plugin-distribution.js";
import { FileHash } from "../../../../src/kernel/file.js";

it("installs OpenCode V2 server and TUI entries in the build's location", () => {
  const hooks = [
    { relativePath: "hooks/hooks.json", content: '{"hooks":{}}' },
    { relativePath: "hooks/opencode-server.js", content: "server" },
    { relativePath: "hooks/opencode-tui.js", content: "tui" },
  ];
  const dist = new PluginDistribution({
    manifest: { name: "sample-plugin", version: "1.0.0" },
    format: "claude",
    files: hooks,
    components: { skills: [], commands: [], agents: [], rules: [], hooks, mcp: [] },
  });
  const translator = new PluginContentTranslator({ hash: () => new FileHash("a".repeat(32)) });
  const tree = Object.fromEntries(
    translator.translate(dist, opencode).map((f) => [f.relativePath, f.content])
  );
  expect(tree[".opencode/plugins/sample-plugin-tui/server.js"]).toBe("server");
  expect(tree[".opencode/plugins/sample-plugin-tui/tui.js"]).toBe("tui");
});
