import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInProcess } from "../../shared/testing/in-process-cli.builder.js";

let root: string;
let server: Server;
let registryBase: string;

/** npm's dist-tags and GitHub's release, from one local server that asks for no credential. */
function startRegistry(): Promise<void> {
  server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    const isVersion = (req.url ?? "").includes("/dist-tags");
    res.end(
      JSON.stringify(isVersion ? { latest: "999.0.0" } : { tag_name: "cli-v999.0.0", body: "" })
    );
  });
  return new Promise((ready) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      registryBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      ready();
    });
  });
}

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "aidd-update-command-")));
  for (const dir of ["project", "home", "user-config", "empty-path"]) {
    await mkdir(join(root, dir), { recursive: true });
  }
  await startRegistry();
});

afterEach(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  await rm(root, { recursive: true, force: true });
});

describe("update --check through the real wiring", () => {
  it("names the newer version with no credential anywhere, and never asks to log in", async () => {
    const result = await runInProcess(["update", "--check"], {
      cwd: join(root, "project"),
      home: join(root, "home"),
      env: {
        AIDD_TOKEN: "",
        AIDD_USER_CONFIG_DIR: join(root, "user-config"),
        AIDD_SELF_UPDATE_API_BASE: registryBase,
        AIDD_SELF_UPDATE_NPM_BASE: registryBase,
        PATH: join(root, "empty-path"),
      },
    });

    expect(result.stderr).not.toMatch(/not authenticated|auth login/i);
    expect(result.stdout).toContain("New version available: 999.0.0");
    expect(result.exitCode).toBe(0);
  });
});
