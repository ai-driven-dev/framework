import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../../shared/testing/in-process-cli.builder.js";
import { readJson, seedEmptyManifest } from "../../testing/project-state.builder.js";

const PLUGIN_FIXTURE = resolve(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

let tempDir: string;
let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ tempDir, projectDir: project, fakeHome: home, cleanup } = await createTestEnv("plugin-life"));
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

async function seedWithClaude(): Promise<void> {
  await seedEmptyManifest(project);
  await aidd(["framework", "install", "--tool", "claude"]);
}

const installSample = () => aidd(["plugin", "install", PLUGIN_FIXTURE, "--tool", "claude"]);

describe("the plugin lifecycle from a local path", () => {
  it("installs a plugin from a local path", async () => {
    await seedWithClaude();
    const { stdout, exitCode } = await aidd(["plugin", "install", PLUGIN_FIXTURE]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Plugin added successfully");
  });

  it("lists the installed plugin", async () => {
    await seedWithClaude();
    await installSample();
    const { stdout, exitCode } = await aidd(["plugin", "list"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("sample-plugin");
  });

  it("reports a healthy project when the tool is installed", async () => {
    await seedWithClaude();
    const { stdout, exitCode } = await aidd(["doctor"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("healthy");
  });

  it("keeps doctor --plugin at 0 and healthy under non-plugin drift, which the unscoped doctor flags", async () => {
    await seedWithClaude();
    await installSample();
    const manifest = await readJson<{ tools: { claude: { files: { relativePath: string }[] } } }>(
      join(project, ".aidd", "manifest.json")
    );
    const tracked = manifest.tools.claude.files[0].relativePath;
    await appendFile(join(project, tracked), "\n<!-- drift -->\n");

    expect((await aidd(["doctor"])).exitCode).toBe(1);

    const { stdout, exitCode } = await aidd(["doctor", "--plugin", "sample-plugin"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("healthy");
  });

  it("reports every plugin up to date when none drifted", async () => {
    await seedWithClaude();
    await installSample();
    const { stdout, exitCode } = await aidd(["plugin", "update"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("up to date");
  });

  it("removes an installed plugin, naming it", async () => {
    await seedWithClaude();
    await installSample();
    const { stdout, exitCode } = await aidd([
      "plugin",
      "remove",
      "sample-plugin",
      "--tool",
      "claude",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("sample-plugin");
    expect(stdout).toContain("removed");
  });

  it("refuses an install with no argument when nothing can be asked", async () => {
    await seedWithClaude();
    const { stderr, exitCode } = await aidd(["plugin", "install"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("interactive");
  });
});

describe("marketplace refresh and sources", () => {
  it("refreshes a registered marketplace by name", async () => {
    await seedEmptyManifest(project);
    const marketDir = join(tempDir, "market");
    await mkdir(join(marketDir, ".claude-plugin"), { recursive: true });
    await writeFile(join(marketDir, ".claude-plugin", "marketplace.json"), '{"plugins":[]}');
    await aidd(["marketplace", "add", "local", marketDir, "--yes"]);
    const { stdout, exitCode } = await aidd(["marketplace", "refresh", "local"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("local");
  });

  it("refuses a file:// source as an invalid plugin source", async () => {
    await seedEmptyManifest(project);
    const { stderr, exitCode } = await aidd([
      "marketplace",
      "add",
      "mymarket",
      "file:///some/path",
      "--yes",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid plugin source");
  });
});

describe("auth without a network", () => {
  it("reports the authentication state", async () => {
    const { stdout, exitCode } = await aidd(["auth", "status"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/[Aa]uthenticated/);
  });

  it("logs out idempotently and reports the state after", async () => {
    const { stdout, exitCode } = await aidd(["auth", "logout"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/[Ll]ogged out|[Nn]ot authenticated/);
  });
});
