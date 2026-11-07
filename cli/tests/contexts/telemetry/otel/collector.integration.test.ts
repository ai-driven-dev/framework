import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { expect, it as test, vi } from "vitest";
import { startOtelCollector } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/collect.js";

const it = test.skipIf(process.platform === "win32");
const TOKEN = "example-private-collector-token";

async function seedToken(home: string): Promise<void> {
  const directory = join(home, ".local/share/aidd-otel-observation");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(join(directory, "collector-token"), `${TOKEN}\n`, { mode: 0o600 });
}

it("captures authenticated OTLP locally, rejects unauthenticated requests, and keeps files private", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-collector-"));
  await seedToken(home);
  const listen = vi.spyOn(Server.prototype, "listen");
  const collector = await startOtelCollector({ home, port: 0 });
  try {
    expect(listen).toHaveBeenCalledOnce();
    expect(listen).toHaveBeenCalledWith(0, "127.0.0.1", expect.any(Function));
    for (const tool of ["claude", "codex", "opencode"]) {
      const file = join(home, `.local/share/aidd-otel-observation/${tool}.jsonl`);
      expect(await readFile(file, "utf8")).toBe("");
      expect((await stat(file)).mode & 0o777).toBe(0o600);
    }
    expect(
      (
        await readFile(join(home, ".local/share/aidd-otel-observation/collector-token"), "utf8")
      ).trim()
    ).toBe(TOKEN);
    const url = `http://127.0.0.1:${collector.port}/claude/v1/logs`;
    const body = JSON.stringify({ resourceLogs: [{ scopeLogs: [] }] });
    expect((await fetch(url, { method: "POST", body })).status).toBe(403);
    expect(
      (await fetch(url, { method: "POST", headers: { authorization: "Bearer wrong" }, body }))
        .status
    ).toBe(403);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${TOKEN}`, "content-encoding": "gzip" },
          body: gzipSync(body),
        })
      ).status
    ).toBe(200);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${TOKEN}` },
          body: "not json",
        })
      ).status
    ).toBe(400);
    expect(
      (
        await fetch(`http://127.0.0.1:${collector.port}/not-a-tool/v1/logs`, {
          method: "POST",
          headers: { authorization: `Bearer ${TOKEN}` },
          body,
        })
      ).status
    ).toBe(404);
    const file = join(home, ".local/share/aidd-otel-observation/claude.jsonl");
    const captured = JSON.parse((await readFile(file, "utf8")).trim());
    expect(captured).toMatchObject({
      signal: "logs",
      payload: { resourceLogs: [{ scopeLogs: [] }] },
    });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(
      (await stat(join(home, ".local/share/aidd-otel-observation/collector-token"))).mode & 0o777
    ).toBe(0o600);
  } finally {
    listen.mockRestore();
    await collector.close();
    await rm(home, { recursive: true, force: true });
  }
});

it("creates a private random token when none exists", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-collector-token-"));
  const collector = await startOtelCollector({ home, port: 0 });
  try {
    const path = join(home, ".local/share/aidd-otel-observation/collector-token");
    expect((await readFile(path, "utf8")).trim()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  } finally {
    await collector.close();
    await rm(home, { recursive: true, force: true });
  }
});

it("does not follow an existing token symlink or replace its target", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-collector-link-"));
  const directory = join(home, ".local/share/aidd-otel-observation");
  const target = join(home, "other-file");
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(target, "do not touch", { mode: 0o600 });
    await symlink(target, join(directory, "collector-token"));
    await expect(startOtelCollector({ home, port: 0 })).rejects.toThrow();
    expect(await readFile(target, "utf8")).toBe("do not touch");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

it("serializes concurrent appends into complete records", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-collector-concurrent-"));
  await seedToken(home);
  const collector = await startOtelCollector({ home, port: 0 });
  try {
    const directory = join(home, ".local/share/aidd-otel-observation");
    const url = `http://127.0.0.1:${collector.port}/codex/v1/logs`;
    const statuses = await Promise.all(
      Array.from({ length: 8 }, (_, number) =>
        fetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify({ number }),
        }).then((response) => response.status)
      )
    );
    expect(statuses).toEqual(Array(8).fill(200));
    const lines = (await readFile(join(directory, "codex.jsonl"), "utf8")).trim().split("\n");
    expect(lines.map((line) => JSON.parse(line).payload.number).sort()).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  } finally {
    await collector.close();
    await rm(home, { recursive: true, force: true });
  }
});

test.runIf(process.platform === "win32")("clearly refuses collection on Windows", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-collector-windows-"));
  try {
    await expect(startOtelCollector({ home, port: 0 })).rejects.toThrow(
      "OTLP collection requires private POSIX files"
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
