import {
  appendFile,
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { expect, it } from "vitest";
import { syncOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync.js";
import { syncAllOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync-all.js";
import { syncAllSessionTitles } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync-all-titles.js";

const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });

it.skipIf(process.platform === "win32")(
  "sends titles only when opted in and the session is consented",
  async () => {
    const home = await mkdtemp(join(tmpdir(), "aidd-title-sync-"));
    const oldPath = process.env.PATH;
    const oldMarker = process.env.AIDD_TEST_TITLE_MARKER;
    const marker = join(home, "called");
    const received: string[] = [];
    let onReceived = (_body: string) => {};
    let responseFor = (_body: string) => 200;
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        received.push(body);
        onReceived(body);
        response.writeHead(responseFor(body)).end("{}");
      });
    });
    try {
      const bin = join(home, "bin");
      const captureDir = join(home, ".local/share/aidd-otel-observation");
      await mkdir(bin);
      await mkdir(captureDir, { recursive: true, mode: 0o700 });
      const fake = join(bin, "codex");
      await writeFile(
        fake,
        `#!${process.execPath}\n` +
          String.raw`
const fs = require('node:fs');
const readline = require('node:readline');
fs.writeFileSync(process.env.AIDD_TEST_TITLE_MARKER, 'called');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  if (!message.id) return;
  if (message.method === 'initialize') fs.writeFileSync(process.env.AIDD_TEST_TITLE_MARKER, JSON.stringify(message.params));
  const result = message.method === 'initialize' ? {} : message.method === 'project/read' ? { project: { id: 'native-project', name: 'Native project' } } : {
    thread: { id: message.params.threadId, sessionId: message.params.threadId,
      name: 'Synthetic title', projectId: 'native-project',
      gitInfo: { originUrl: 'git@github.com:example/repository.git' }, turns: [] }
  };
  process.stdout.write(JSON.stringify({ id: message.id, result }) + '\n');
});
`
      );
      await chmod(fake, 0o700);
      process.env.PATH = `${bin}${delimiter}${oldPath ?? ""}`;
      process.env.AIDD_TEST_TITLE_MARKER = marker;
      const capture = {
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
                        attr("conversation.id", "session-1"),
                        attr("user.email", "person@example.test"),
                        attr("event.name", "codex.sse_event"),
                        attr("event.kind", "response.completed"),
                        attr("input_token_count", "3"),
                        attr("output_token_count", "1"),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      await writeFile(join(captureDir, "codex.jsonl"), `${JSON.stringify(capture)}\n`, {
        mode: 0o600,
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No test port");
      const options = {
        config: "codex" as const,
        session: "session-1",
        tenant: "test",
        endpoint: `http://127.0.0.1:${address.port}`,
        token: "test",
        home,
        follow: false,
      };
      const resolve = async () => ({ state: "unbound" as const });

      await syncOtel(options, resolve, async () => true);
      await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect(received).toHaveLength(1);

      received.length = 0;
      await syncOtel(
        { ...options, includeSessionTitles: true },
        resolve,
        async (transfer) => Object.keys(transfer.payload).length > 0
      );
      await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect(received).toHaveLength(1);

      received.length = 0;
      await syncOtel(
        { ...options, includeSessionTitles: true, titlesOnly: true },
        resolve,
        async () => false
      );
      await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect(received).toHaveLength(0);

      received.length = 0;
      await syncOtel({ ...options, includeSessionTitles: true }, resolve, async () => true);
      expect(received).toHaveLength(2);
      expect(received[1]).toContain("aidd.session_title");
      expect(received[1]).toContain("Synthetic title");
      expect(await readFile(marker, "utf8")).not.toContain("experimentalApi");
      expect(received[1]).not.toContain("aidd.feature");

      received.length = 0;
      await syncOtel(
        { ...options, includeSessionTitles: true, titlesOnly: true },
        async () => ({ state: "confirmed", feature: "owner/repo#42", branch: "feat/demo" }),
        async () => true
      );
      expect(received).toHaveLength(1);
      expect(received[0]).toContain("Synthetic title");
      expect(received[0]).not.toContain("input_token_count");
      expect(received[0]).not.toContain("aidd.feature");

      received.length = 0;
      await syncOtel(
        { ...options, includeSessionTitles: true, titlesOnly: true },
        resolve,
        async (transfer) => !JSON.stringify(transfer.payload).includes("aidd.session_title")
      );
      expect(received).toHaveLength(0);

      received.length = 0;
      await syncOtel({ ...options, includeSessionProjects: true }, resolve, async () => true);
      expect(received).toHaveLength(2);
      expect(received[1]).toContain("aidd.session_project");
      expect(received[1]).toContain("aidd.project_id");
      expect(received[1]).toContain("Native project");
      expect(await readFile(marker, "utf8")).toContain('"experimentalApi":true');
      expect(received[1]).not.toContain("Synthetic title");
      expect(received[1]).not.toContain("input_token_count");
      received.length = 0;
      await syncOtel(
        { ...options, includeSessionProjects: true },
        resolve,
        async (transfer) => !JSON.stringify(transfer.payload).includes("aidd.session_project")
      );
      expect(received).toHaveLength(1);
      expect(received.join()).not.toContain("aidd.project_name");

      received.length = 0;
      await syncOtel({ ...options, includeSessionRepositories: true }, resolve, async () => true);
      expect(received).toHaveLength(2);
      expect(received[1]).toContain("aidd.session_repository");
      expect(received[1]).toContain("https://github.com/example/repository");
      expect(received[1]).not.toContain("git@github.com");
      expect(received[1]).not.toContain("Synthetic title");
      received.length = 0;
      await syncOtel(
        { ...options, includeSessionRepositories: true },
        resolve,
        async (transfer) => !JSON.stringify(transfer.payload).includes("aidd.session_repository")
      );
      expect(received).toHaveLength(1);
      expect(received.join()).not.toContain("aidd.repository_url");

      received.length = 0;
      const captureFile = join(captureDir, "codex.jsonl");
      await appendFile(captureFile, `${JSON.stringify(capture)}\n`.repeat(10));
      await appendFile(
        captureFile,
        `${JSON.stringify(capture).replaceAll("session-1", "session-2")}\n`
      );
      await appendFile(
        captureFile,
        `${JSON.stringify(capture).replaceAll("session-1", "session-4")}\n`
      );
      const original = capture.payload.resourceLogs[0].scopeLogs[0].logRecords[0];
      const attrs = original.attributes.map((a) =>
        a.key === "conversation.id" ? attr(a.key, "session-3") : a
      );
      const denied = { ...original, timeUnixNano: "1793763899000000000", attributes: attrs };
      const admitted = { ...original, attributes: attrs.filter((a) => a.key !== "user.email") };
      const incomplete = {
        signal: "logs",
        payload: { resourceLogs: [{ scopeLogs: [{ logRecords: [denied, admitted] }] }] },
      };
      await appendFile(captureFile, `${JSON.stringify(incomplete)}\n`);
      const admissions = new Map([
        [
          "session-1",
          { feature: { state: "unbound" as const }, cwd: "/project", repositoryId: "allow" },
        ],
        [
          "session-2",
          { feature: { state: "unbound" as const }, cwd: "/project", repositoryId: "deny" },
        ],
        [
          "session-3",
          { feature: { state: "unbound" as const }, cwd: "/project", repositoryId: "mixed" },
        ],
        [
          "session-4",
          { feature: { state: "unbound" as const }, cwd: "/project", repositoryId: "allow-2" },
        ],
      ]);
      const deniedTime = new Date(1_793_763_899_000).toISOString();
      let allowedChecks = 0;
      const result = await syncAllSessionTitles(
        { ...options, includeSessionTitles: true, stateDir: join(home, "state") },
        async () => admissions,
        async (admission, at) => {
          if (admission.repositoryId === "allow") allowedChecks++;
          return admission.repositoryId === "deny" ||
            (admission.repositoryId === "mixed" && at === deniedTime)
            ? "deny"
            : "allow";
        }
      );
      expect(result.sent).toBe(2);
      expect(result.identified).toBe(2);
      expect(result.currentConsenting).toBe(2);
      expect(allowedChecks).toBe(4);
      expect(received).toHaveLength(2);
      expect(received.some((body) => body.includes("session-1"))).toBe(true);
      expect(received.some((body) => body.includes("session-4"))).toBe(true);
      expect(received.join()).not.toContain("session-2");
      expect(received.join()).not.toContain("session-3");
      expect(received.join()).not.toContain("input_token_count");
      expect(received.join()).not.toContain("aidd.feature");
      await expect(readdir(join(home, "state"))).rejects.toMatchObject({ code: "ENOENT" });

      received.length = 0;
      const metadata = await syncAllSessionTitles(
        {
          ...options,
          includeSessionTitles: true,
          includeSessionProjects: true,
          includeSessionRepositories: true,
          stateDir: join(home, "state"),
        },
        async () => admissions,
        async (admission, at) =>
          admission.repositoryId === "deny" ||
          (admission.repositoryId === "mixed" && at === deniedTime)
            ? "deny"
            : "allow"
      );
      expect(metadata.sent).toBe(6);
      expect(received.filter((body) => body.includes("aidd.session_project"))).toHaveLength(2);
      expect(received.filter((body) => body.includes("aidd.session_repository"))).toHaveLength(2);
      expect(received.join()).not.toContain("input_token_count");
      expect(received.join()).not.toContain("aidd.feature");
      await expect(readdir(join(home, "state"))).rejects.toMatchObject({ code: "ENOENT" });

      received.length = 0;
      let checks = 0;
      const admittedSession = admissions.get("session-1");
      if (!admittedSession) throw new Error("Missing test admission.");
      const withdrawn = await syncAllSessionTitles(
        { ...options, includeSessionTitles: true },
        async () => new Map([["session-1", admittedSession]]),
        async () => (++checks < 3 ? "allow" : "deny")
      );
      expect(withdrawn.sent).toBe(0);
      expect(withdrawn.currentConsenting).toBe(0);
      expect(received).toHaveLength(0);

      const noSourceConsent = await syncAllSessionTitles(
        { ...options, includeSessionTitles: true },
        async () => new Map([["session-1", admittedSession]]),
        async () => "deny"
      );
      expect(noSourceConsent).toMatchObject({ sent: 0, identified: 0, currentConsenting: 0 });

      const captureTime = new Date(1_793_763_900_000).toISOString();
      const noCurrentConsent = await syncAllSessionTitles(
        { ...options, includeSessionTitles: true },
        async () => new Map([["session-1", admittedSession]]),
        async (_admission, at) => (at === captureTime ? "allow" : "deny")
      );
      expect(noCurrentConsent).toMatchObject({ sent: 0, identified: 1, currentConsenting: 0 });

      received.length = 0;
      await appendFile(
        captureFile,
        `${JSON.stringify(capture).replaceAll("person@example.test", "PERSON@EXAMPLE.TEST")}\n`
      );
      const conflictingIdentity = await syncAllSessionTitles(
        { ...options, includeSessionTitles: true },
        async () => new Map([["session-1", admittedSession]]),
        async () => "allow"
      );
      expect(conflictingIdentity).toMatchObject({ sent: 0, identified: 0 });
      expect(received).toHaveLength(0);

      received.length = 0;
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 3000);
      onReceived = (body) => {
        if (body.includes("aidd.session_repository")) abort.abort();
      };
      const admission = {
        feature: { state: "unbound" as const },
        cwd: "/project",
        repositoryId: "repo",
      };
      const running = syncAllOtel(
        {
          ...options,
          stateDir: join(home, "state"),
          includeSessionTitles: true,
          includeSessionRepositories: true,
          signal: abort.signal,
          intervalMs: 10,
        },
        async () => new Map([["session-1", admission]]),
        async () => "allow"
      );
      await new Promise((done) => setTimeout(done, 100));
      await appendFile(join(captureDir, "codex.jsonl"), `${JSON.stringify(capture)}\n`);
      await running;
      clearTimeout(timeout);
      expect(received.some((body) => body.includes("Synthetic title"))).toBe(true);
      expect(received.some((body) => body.includes("https://github.com/example/repository"))).toBe(
        true
      );

      received.length = 0;
      let consenting = true;
      await writeFile(join(captureDir, "codex.jsonl"), `${JSON.stringify(capture)}\n`, {
        mode: 0o600,
      });
      onReceived = () => {};
      responseFor = (body) => {
        if (!body.includes("aidd.session_title")) return 200;
        consenting = false;
        return 503;
      };
      await expect(
        syncOtel(
          { ...options, follow: true, intervalMs: 10, includeSessionTitles: true },
          resolve,
          async () => consenting
        )
      ).rejects.toThrow(/Consent is no longer confirmed/);
      expect(received.filter((body) => body.includes("aidd.session_title"))).toHaveLength(1);

      received.length = 0;
      consenting = true;
      const retryAll = syncAllOtel(
        {
          ...options,
          stateDir: join(home, "withdrawn-state"),
          includeSessionTitles: true,
          intervalMs: 10,
        },
        async () => new Map([["session-1", admission]]),
        async () => (consenting ? "allow" : "deny")
      );
      await new Promise((done) => setTimeout(done, 100));
      await appendFile(join(captureDir, "codex.jsonl"), `${JSON.stringify(capture)}\n`);
      await expect(retryAll).rejects.toThrow(/Consent is no longer confirmed/);
      expect(received.filter((body) => body.includes("aidd.session_title"))).toHaveLength(1);
    } finally {
      process.env.PATH = oldPath;
      if (oldMarker === undefined) delete process.env.AIDD_TEST_TITLE_MARKER;
      else process.env.AIDD_TEST_TITLE_MARKER = oldMarker;
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(home, { recursive: true, force: true });
    }
  }
);
