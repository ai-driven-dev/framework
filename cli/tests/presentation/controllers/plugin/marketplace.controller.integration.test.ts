import { cp, mkdir, realpath, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestEnv,
  pathWithoutAidd,
  writeFakeToolBinary,
} from "../../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../../shared/testing/in-process-cli.builder.js";
import { seedEmptyManifest } from "../../testing/project-state.builder.js";

const PLUGIN_FIXTURE = resolve(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

let tempDir: string;
let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ tempDir, projectDir: project, fakeHome: home, cleanup } = await createTestEnv("marketplace"));
  await seedEmptyManifest(project);
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

/** A catalog directory listing the given plugins, at the path a marketplace is read from. */
async function writeMarketplace(plugins: Array<Record<string, unknown>>): Promise<string> {
  const dir = join(tempDir, "market");
  await mkdir(join(dir, ".claude-plugin"), { recursive: true });
  await writeFile(join(dir, ".claude-plugin", "marketplace.json"), JSON.stringify({ plugins }));
  return dir;
}

const sample = (extra: Record<string, unknown> = {}) => ({
  name: "sample-plugin",
  source: { kind: "local", path: PLUGIN_FIXTURE },
  version: "1.0.0",
  ...extra,
});

describe("a marketplace from registration to removal", () => {
  it("registers a project-scope marketplace without a trust prompt under --yes", async () => {
    await aidd(["framework", "install", "--tool", "claude"]);
    const dir = await writeMarketplace([sample()]);

    const { stdout, exitCode } = await aidd(["marketplace", "add", "local", dir, "--yes"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("'local' registered");
  });

  it("lists a registered entry with its scope", async () => {
    const dir = await writeMarketplace([]);
    await aidd(["marketplace", "add", "local", dir, "--yes"]);

    const { stdout, exitCode } = await aidd(["marketplace", "list"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("local [project]");
  });

  it("finds a plugin across the registered marketplaces", async () => {
    const dir = await writeMarketplace([sample({ description: "Sample" })]);
    await aidd(["marketplace", "add", "local", dir, "--yes"]);

    const { stdout, exitCode } = await aidd(["plugin", "search", "sample"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("sample-plugin@1.0.0");
    expect(stdout).toContain("marketplace: local");
  });

  it("installs a plugin by name from a registered marketplace", async () => {
    await aidd(["framework", "install", "--tool", "claude"]);
    const dir = await writeMarketplace([sample()]);
    await aidd(["marketplace", "add", "local", dir, "--yes"]);

    const { stdout, exitCode } = await aidd([
      "plugin",
      "install",
      "sample-plugin",
      "--tool",
      "claude",
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("'sample-plugin'");
  });

  it("unregisters a marketplace, leaving none listed", async () => {
    const dir = await writeMarketplace([]);
    await aidd(["marketplace", "add", "local", dir, "--yes"]);

    const { stdout, exitCode } = await aidd(["marketplace", "remove", "local", "--yes"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("'local' removed");
    expect((await aidd(["marketplace", "list"])).stdout).toContain("No marketplaces");
  });

  it("reports every marketplace fresh once refreshed", async () => {
    const dir = await writeMarketplace([]);
    await aidd(["marketplace", "add", "local", dir, "--yes"]);
    await aidd(["marketplace", "refresh"]);

    const { stdout, exitCode } = await aidd(["marketplace", "check"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("All marketplaces fresh");
  });
});

/** A claude-shaped catalog at the path a marketplace identity is read from; the identity is
 * the plugin name, never the version. */
async function writeNamedCatalog(dir: string, name: string, pluginName: string): Promise<void> {
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

describe("adding a marketplace whose name the host already holds under another catalog", () => {
  it("exits non-zero, names both sources and the plugin difference, and never reports a registration", async () => {
    const binDir = join(tempDir, "bin");
    await writeFakeToolBinary(binDir, "claude", join(tempDir, "claude-invocations.log"));
    const env = { PATH: `${binDir}${delimiter}${pathWithoutAidd()}` };
    const run = (args: string[]) => runInProcess(args, { cwd: project, home, env });
    await run(["framework", "install", "--tool", "claude"]);

    const registered = join(tempDir, "registered");
    await writeNamedCatalog(registered, "shared-catalog", "sample-plugin");
    // What `claude plugin marketplace add` would have written; only `installLocation` is read.
    const hostDir = join(home, ".claude", "plugins");
    await mkdir(hostDir, { recursive: true });
    await writeFile(
      join(hostDir, "known_marketplaces.json"),
      JSON.stringify({ "shared-catalog": { installLocation: await realpath(registered) } })
    );
    const requested = join(tempDir, "requested");
    await writeNamedCatalog(requested, "shared-catalog", "different-plugin");

    const { stdout, stderr, exitCode } = await run([
      "marketplace",
      "add",
      "shared-catalog",
      requested,
      "--yes",
    ]);

    const output = stdout + stderr;
    expect(exitCode).not.toBe(0);
    expect(output).toMatch(/shared-catalog/);
    expect(output).toMatch(/\+different-plugin/);
    expect(output).toMatch(/-sample-plugin/);
    expect(output).not.toMatch(/^Marketplace 'shared-catalog' registered\.$/m);
  });
});
