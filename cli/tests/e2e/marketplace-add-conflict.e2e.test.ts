import { cp, mkdir, realpath, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createTestEnv,
  FRAMEWORK_PATH,
  initProject,
  pathWithoutAidd,
  runCli,
  writeFakeToolBinary,
} from "./helpers.js";

const PLUGIN_FIXTURE = resolve(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

/** A claude-shaped catalog at the exact path `readMarketplaceCatalogIdentity` reads.
 * Identity is `pluginName`, never the version, which two writes of one catalog may differ on. */
async function writeCatalog(dir: string, name: string, pluginName: string): Promise<void> {
  await mkdir(join(dir, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(dir, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      plugins: [
        {
          name: pluginName,
          source: `./plugins/${pluginName}`,
          version: "1.0.0",
          description: "sample plugin",
        },
      ],
    })
  );
  await cp(PLUGIN_FIXTURE, join(dir, "plugins", pluginName), { recursive: true });
}

/** Stands in for what `claude plugin marketplace add` would have written to
 * `known_marketplaces.json`; only `installLocation` is read by this project's own guard. */
async function writeKnownMarketplaces(
  fakeHome: string,
  name: string,
  installLocation: string
): Promise<void> {
  const dir = join(fakeHome, ".claude", "plugins");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "known_marketplaces.json"),
    JSON.stringify({ [name]: { installLocation } })
  );
}

describe("E2E: marketplace add surfaces the source-conflict guard's refusal instead of a false success", () => {
  it("exits non-zero and names both sources and the plugin difference when the host's registry already holds this name under a different catalog", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv(
      "marketplace-add-conflict"
    );
    try {
      const logFile = join(tempDir, "claude-invocations.log");
      const binDir = join(tempDir, "bin");
      await writeFakeToolBinary(binDir, "claude", logFile);
      const env = { PATH: `${binDir}${delimiter}${pathWithoutAidd()}` };

      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["framework", "install", "--tool", "claude"], projectDir, fakeHome, { env });

      const registeredDir = join(tempDir, "registered");
      await writeCatalog(registeredDir, "shared-catalog", "sample-plugin");
      await writeKnownMarketplaces(fakeHome, "shared-catalog", await realpath(registeredDir));

      const requestedDir = join(tempDir, "requested");
      await writeCatalog(requestedDir, "shared-catalog", "different-plugin");

      const { stdout, stderr, exitCode } = await runCli(
        ["marketplace", "add", "shared-catalog", requestedDir, "--yes"],
        projectDir,
        fakeHome,
        { env }
      );

      const output = stdout + stderr;
      expect(exitCode).not.toBe(0);
      expect(output).toMatch(/shared-catalog/);
      expect(output).toMatch(/\+different-plugin/);
      expect(output).toMatch(/-sample-plugin/);
      expect(output).not.toMatch(/^Marketplace 'shared-catalog' registered\.$/m);
    } finally {
      await cleanup();
    }
  });
});
