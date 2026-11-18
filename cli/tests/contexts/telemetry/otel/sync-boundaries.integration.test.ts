import { execFile } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConsentNotConfirmedError,
  destination,
  OtelObservationTooLargeError,
  packTransfers,
  type SyncOptions,
  send,
  syncOtel,
  type Transfer,
} from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync.js";

const execFileAsync = promisify(execFile);
const directories: string[] = [];
const servers: Server[] = [];

const options: SyncOptions = {
  config: "claude",
  session: "wanted",
  tenant: "test-tenant",
  endpoint: "http://127.0.0.1:3000",
  token: "synthetic-token",
  home: "/not-used",
  follow: false,
};

const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });
const log = (event: string, session = "wanted") =>
  JSON.stringify({
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  timeUnixNano: "1793763900000000000",
                  attributes: [
                    attr("session.id", session),
                    attr("event.name", "tool_result"),
                    attr("tool_use_id", event),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

async function capture(contents: string, mode = 0o600) {
  const root = await mkdtemp(join(tmpdir(), "aidd-sync-boundaries-"));
  directories.push(root);
  const directory = join(root, ".local/share/aidd-otel-observation");
  await mkdir(directory, { recursive: true });
  const path = join(directory, "claude.jsonl");
  await writeFile(path, contents, { mode });
  return { root, path };
}

async function receiver(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
  for (const dir of directories.splice(0)) {
    if (process.platform === "darwin" && !process.env.CI) await execFileAsync("trash", [dir]);
    else await rm(dir, { recursive: true, force: true });
  }
});

describe("OTLP destination and delivery boundaries", () => {
  it.each([
    "http://localhost:3000",
    "http://127.0.0.2:3000",
    "https://127.0.0.1:3000",
    "http://user:pass@127.0.0.1:3000",
    "http://127.0.0.1:3000/path",
    "http://127.0.0.1:3000/?query=x",
    "http://127.0.0.1:3000/#fragment",
  ])("refuses the noncanonical destination %s", (endpoint) => {
    expect(() => destination({ ...options, endpoint }, "logs")).toThrow(/loopback HTTP origin/);
  });

  it("addresses IPv6 loopback and the Codex-specific traces endpoint", () => {
    expect(
      destination({ ...options, config: "codex", endpoint: "http://[::1]:3000" }, "traces").href
    ).toBe("http://[::1]:3000/api/kpi/otel/codex/test-tenant/v1/traces");
  });

  it("does not follow a redirect or forward the bearer token to its target", async () => {
    let redirects = 0;
    let targets = 0;
    const endpoint = await receiver((request, response) => {
      request.resume();
      request.on("end", () => {
        if (request.url === "/target") {
          targets++;
          response.writeHead(200).end("{}");
        } else {
          redirects++;
          response.writeHead(302, { location: "/target" }).end();
        }
      });
    });
    await expect(
      send({ ...options, endpoint }, { signal: "logs", payload: {} }, async () => true)
    ).rejects.toThrow(/HTTP 302/);
    expect({ redirects, targets }).toEqual({ redirects: 1, targets: 0 });
  });

  it("refuses a partial traces response instead of reporting full delivery", async () => {
    let requests = 0;
    const endpoint = await receiver((request, response) => {
      request.resume();
      request.on("end", () => {
        requests++;
        response.writeHead(200).end(JSON.stringify({ partialSuccess: { rejectedSpans: "1" } }));
      });
    });
    await expect(
      send(
        { ...options, endpoint, follow: true },
        { signal: "traces", payload: {} },
        async () => true
      )
    ).rejects.toThrow(/partial traces delivery/);
    expect(requests).toBe(1);
  });

  it("splits large observations without exceeding the receiver limit or losing records", () => {
    const make = (value: string): Transfer => ({
      signal: "logs",
      at: "2026-11-04T00:00:00.000Z",
      payload: { resourceLogs: [{ value: value.repeat(1_100_000) }] },
    });
    const batches = packTransfers([make("a"), make("b")]);
    expect(batches.map((batch) => batch.count)).toEqual([1, 1]);
    expect(batches.map((batch) => JSON.stringify(batch.transfer.payload))).toEqual([
      expect.stringContaining("a".repeat(100)),
      expect.stringContaining("b".repeat(100)),
    ]);
    for (const batch of batches)
      expect(Buffer.byteLength(JSON.stringify(batch.transfer.payload))).toBeLessThanOrEqual(
        2 * 1024 * 1024
      );
    expect(() => packTransfers([make("éé")])).toThrow(OtelObservationTooLargeError);
  });
});

describe.skipIf(process.platform === "win32")("OTLP private captures", () => {
  it("refuses a world-readable capture and a symlink without sending either", async () => {
    const { root, path } = await capture(`${log("a")}\n`);
    let requests = 0;
    const endpoint = await receiver((request, response) => {
      requests++;
      request.resume();
      response.writeHead(200).end("{}");
    });
    await chmod(path, 0o644);
    await expect(
      syncOtel(
        { ...options, home: root, endpoint },
        async () => {},
        async () => true
      )
    ).rejects.toThrow(/private regular file/);
    await rename(path, `${path}.target`);
    await chmod(`${path}.target`, 0o600);
    await symlink(`${path}.target`, path);
    await expect(
      syncOtel(
        { ...options, home: root, endpoint },
        async () => {},
        async () => true
      )
    ).rejects.toThrow();
    expect(requests).toBe(0);
  });

  it.each(["replace", "truncate"] as const)(
    "stops if the capture is %sd during delivery",
    async (change) => {
      const { root, path } = await capture(`${log("a")}\n`);
      let requests = 0;
      const endpoint = await receiver((request, response) => {
        request.resume();
        request.on("end", () => {
          requests++;
          void (async () => {
            if (change === "replace") {
              await rename(path, `${path}.previous`);
              await writeFile(path, `${log("b")}\n`, { mode: 0o600 });
            } else await truncate(path, 0);
            response.writeHead(200).end("{}");
          })().catch((error: unknown) => response.writeHead(500).end(String(error)));
        });
      });
      await expect(
        syncOtel(
          { ...options, home: root, endpoint },
          async () => {},
          async () => true
        )
      ).rejects.toThrow(/capture was replaced or truncated/i);
      expect(requests).toBe(1);
    }
  );

  it("does not deliver a packed metric batch if any member loses consent before the post", async () => {
    const starts = ["1793763000000000000", "1793763200000000000"];
    const points = starts.map((startTimeUnixNano) => ({
      startTimeUnixNano,
      timeUnixNano: "1793763900000000000",
      asInt: "17",
      attributes: [attr("session.id", "wanted"), attr("type", "input")],
    }));
    const source = JSON.stringify({
      signal: "metrics",
      payload: {
        resourceMetrics: [
          {
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: "claude_code.token.usage",
                    sum: { aggregationTemporality: 2, isMonotonic: true, dataPoints: points },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const { root } = await capture(`${source}\n`);
    let requests = 0;
    let revalidations = 0;
    const endpoint = await receiver((request, response) => {
      requests++;
      request.resume();
      response.writeHead(200).end("{}");
    });
    const revokedStart = new Date(Number(BigInt(starts[1]) / 1_000_000n)).toISOString();
    await expect(
      syncOtel(
        { ...options, home: root, endpoint },
        async () => {
          revalidations++;
        },
        async (item) => !item.consentAt || item.start !== revokedStart
      )
    ).rejects.toThrow(ConsentNotConfirmedError);
    expect(revalidations).toBe(1);
    expect(requests).toBe(0);
  });

  it("sends complete lines again when an incomplete fragment is finished", async () => {
    const first = `${log("a")}\n`;
    const second = `${log("b")}\n`;
    const middle = Math.floor(second.length / 2);
    const { root, path } = await capture(first + second.slice(0, middle));
    const bodies: string[] = [];
    const endpoint = await receiver((request, response) => {
      let body = "";
      request.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        bodies.push(body);
        response.writeHead(200).end("{}");
      });
    });
    const run = () =>
      syncOtel(
        { ...options, home: root, endpoint },
        async () => {},
        async () => true
      );
    const firstRun = await run();
    expect(firstRun).toMatchObject({
      sent: 1,
      partialLine: true,
      offset: Buffer.byteLength(first),
    });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain('"stringValue":"a"');
    const saved = await readFile(path, "utf8");
    await writeFile(path, saved + second.slice(middle), { mode: 0o600 });
    const replay = await run();
    expect(replay).toMatchObject({ sent: 2, partialLine: false });
    expect(bodies).toHaveLength(3);
    expect(bodies[1]).toContain('"stringValue":"a"');
    expect(bodies[2]).toContain('"stringValue":"b"');
  });
});
