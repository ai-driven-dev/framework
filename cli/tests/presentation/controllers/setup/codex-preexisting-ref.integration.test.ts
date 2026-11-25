import { mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestEnv,
  pathWithoutAidd,
  writeFakeToolBinary,
} from "../../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../../shared/testing/in-process-cli.builder.js";
import { setupFromFixture } from "../../testing/fixture-setup.builder.js";

const PLUGIN_NAME = "aidd-vcs";
const THEIR_OWN_ENABLE = `[plugins."${PLUGIN_NAME}@aidd-framework"]\nenabled = true\n`;

let tempDir: string;
let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ tempDir, projectDir: project, fakeHome: home, cleanup } = await createTestEnv("codex-ref"));
});

afterEach(async () => {
  await cleanup();
});

describe("a codex plugin enabled before setup stays with the person who enabled it", () => {
  it("setup never enables it again, and clean never removes it", async () => {
    const logFile = join(tempDir, "codex-invocations.log");
    const binDir = join(tempDir, "bin");
    await writeFakeToolBinary(binDir, "codex", logFile);
    const env = { PATH: `${binDir}${delimiter}${pathWithoutAidd()}` };
    const codexConfig = join(home, ".codex", "config.toml");
    await mkdir(join(home, ".codex"), { recursive: true });
    await writeFile(codexConfig, THEIR_OWN_ENABLE);
    const aidd = (args: string[]) => runInProcess(args, { cwd: project, home, env });

    const setup = await aidd(setupFromFixture("codex", PLUGIN_NAME));
    expect(setup.exitCode, setup.stderr).toBe(0);
    const clean = await aidd(["clean", "--force"]);
    expect(clean.exitCode, clean.stderr).toBe(0);

    const log = await readFile(logFile, "utf-8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    expect(log).toContain("plugin marketplace list --json");
    expect(log).not.toContain("plugin marketplace add");
    expect(log).not.toContain("plugin add");
    expect(log).not.toContain("plugin remove");
    expect(await readFile(codexConfig, "utf-8")).toBe(THEIR_OWN_ENABLE);
  });
});
