import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/init.js";
import { runOtelOpenCode } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/run.js";
import type { Host } from "../../../../src/contexts/telemetry/infrastructure/otel/settings.js";

describe.skipIf(process.platform === "win32")("OpenCode OTLP launcher", () => {
  let home: string;
  let bin: string;
  let host: Host;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "aidd-otel-launch-"));
    bin = join(home, "bin");
    const collector = join(home, ".local/share/aidd-otel-observation");
    await mkdir(collector, { recursive: true });
    await mkdir(bin);
    await writeFile(join(collector, "collector-token"), "test-token", { mode: 0o600 });
    host = {
      home,
      env: { PATH: bin, OPENCODE_CONFIG_DIR: join(home, "config") },
      opencodeVersion: async () => "1.18.35",
    };
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it("requires an initialized v1 configuration and rejects v2", async () => {
    await expect(runOtelOpenCode([], host)).rejects.toThrow(/Initialize OpenCode 1 OTLP/);
    await expect(
      runOtelOpenCode([], { ...host, opencodeVersion: async () => "2.2.5" })
    ).rejects.toThrow(/OpenCode 1/);
  });

  it("passes local OTLP credentials and command arguments to v1", async () => {
    await initializeOtel("opencode", "dev", host);
    const executable = join(bin, "opencode");
    await writeFile(
      executable,
      `#!/bin/sh
[ "$1" = "check" ] || exit 31
[ "$OTEL_EXPORTER_OTLP_ENDPOINT" = "http://127.0.0.1:14318/opencode" ] || exit 32
[ "$OTEL_EXPORTER_OTLP_HEADERS" = "Authorization=Bearer test-token" ] || exit 33
exit 0
`
    );
    await chmod(executable, 0o700);
    expect(await runOtelOpenCode(["check"], host)).toBe(0);
    expect(await runOtelOpenCode(["other"], host)).toBe(31);
  });

  it("refuses conflicting inherited endpoints and a missing executable", async () => {
    await initializeOtel("opencode", "dev", host);
    await expect(
      runOtelOpenCode([], {
        ...host,
        env: { ...host.env, OTEL_EXPORTER_OTLP_ENDPOINT: "https://different.example" },
      })
    ).rejects.toThrow(/Conflicting OTLP setting/);
    await expect(runOtelOpenCode([], host)).rejects.toThrow(/Could not launch OpenCode/);
  });

  it("propagates a child terminated by a signal", async () => {
    await initializeOtel("opencode", "dev", host);
    const executable = join(bin, "opencode");
    await writeFile(executable, "#!/bin/sh\nkill -TERM $$\n");
    await chmod(executable, 0o700);
    expect(await runOtelOpenCode([], host)).toBe(143);
  });
});
