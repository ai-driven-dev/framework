const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { chmodSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const doctor = path.resolve(__dirname, "../doctor.sh");
const basePath = process.platform === "win32" ? (process.env.PATH ?? "") : "/usr/bin:/bin";

for (const [version, supported] of [
  ["20.20.0", false],
  ["22.12.0", false],
  ["22.17.0", false],
  ["22.18.0", true],
  ["23.11.0", false],
  ["24.10.0", false],
  ["24.11.0", true],
  ["25.0.0", false],
  ["26.0.0", true],
]) {
  test(`contributor preflight ${supported ? "accepts" : "rejects"} Node ${version}`, () => {
    const dir = mkdtempSync(path.join(tmpdir(), "aidd-doctor-node-"));
    try {
      writeFileSync(path.join(dir, "node"), `#!/bin/sh\nprintf 'v${version}\\n'\n`);
      writeFileSync(path.join(dir, "pnpm"), "#!/bin/sh\nprintf 'test-pnpm\\n'\n");
      chmodSync(path.join(dir, "node"), 0o755);
      chmodSync(path.join(dir, "pnpm"), 0o755);
      const result = spawnSync("bash", [doctor, "contributor"], {
        cwd: dir,
        env: { PATH: [dir, basePath].join(path.delimiter), SystemRoot: process.env.SystemRoot },
        encoding: "utf8",
      });
      assert.ifError(result.error);
      assert.ok(result.stdout.includes(`node v${version}`), result.stdout + result.stderr);
      assert.ok(result.stdout.includes("pnpm test-pnpm"), result.stdout + result.stderr);
      assert.equal(result.status, supported ? 0 : 1, result.stdout + result.stderr);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
