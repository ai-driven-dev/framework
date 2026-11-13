import { chmod } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { TOOL } from "../../tools/testing/catalog-of.js";
import { PROJECT, registryHome } from "../testing/registry-home.js";

const { home, write, readerFor } = registryHome();

for (const [tool, path] of [
  [TOOL.claude, ".claude/plugins/installed_plugins.json"],
  [TOOL.codex, ".codex/config.toml"],
  [TOOL.copilot, ".copilot/settings.json"],
] as const) {
  it.runIf(process.platform !== "win32" && process.getuid?.() !== 0)(
    `${tool} keeps an EACCES registry unproven`,
    async () => {
      await write(path, "{}\n");
      const target = join(home(), path);
      await chmod(target, 0o000);
      try {
        const reading = await readerFor(tool).read(PROJECT);
        expect(reading.refs).toBeUndefined();
        expect(reading.absent).toBeUndefined();
        expect(reading.unreadable).toMatch(/EACCES|EPERM/);
      } finally {
        await chmod(target, 0o600);
      }
    }
  );
}
