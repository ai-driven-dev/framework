import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { exchangeOf, SERVER_RECORDING } from "./server-recording.builder.js";

const TOKEN = "replayed-token";

/** A host binary that serves what the real host's plugin server was recorded answering: the
 * banner it printed and, for each call, the body it replied with, with the installed plugin's id
 * and source taken from the call. Stateful, so a list shows what was installed. Each server it
 * starts appends its pid to `pids`, and with `refusing` answers every plugin call with the
 * recorded refusal of a bad path. */
export async function writeReplayHost(
  dir: string,
  options: { refusing: boolean }
): Promise<{ readonly pids: () => Promise<number[]> }> {
  const recorded = {
    banner: SERVER_RECORDING.banner,
    unauthenticated: exchangeOf("unauthenticated").response,
    install: exchangeOf("install").response,
    list: exchangeOf("list").response,
    remove: exchangeOf("remove").response,
    removeAbsent: exchangeOf("remove-absent").response,
    refusal: exchangeOf("install-bad-path").response,
  };
  const script = `#!${process.execPath}
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const recorded = ${JSON.stringify(recorded)};
const held = new Map();
const refusing = ${JSON.stringify(options.refusing)};
const withPlugin = (body, id, source) => {
  const reply = JSON.parse(body);
  return { ...reply, data: { ...reply.data, id, originalSource: source } };
};
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const send = (text) => response.end(typeof text === "string" ? text : JSON.stringify(text));
    if (request.headers.authorization !== "Bearer ${TOKEN}") return send(recorded.unauthenticated);
    if (refusing) return send(recorded.refusal);
    const remove = /^\\/api\\/v1\\/plugins\\/(.+):remove$/.exec(request.url);
    if (request.method === "POST" && remove) {
      return send(held.delete(remove[1]) ? recorded.remove : recorded.removeAbsent);
    }
    if (request.method === "POST") {
      const source = JSON.parse(Buffer.concat(chunks).toString()).source;
      held.set(path.basename(source), source);
      return send(withPlugin(recorded.install, path.basename(source), source));
    }
    const listed = JSON.parse(recorded.list);
    const [template] = listed.data.plugins;
    listed.data.plugins = [...held].map(([id, source]) => ({ ...template, id, originalSource: source }));
    return send(listed);
  });
});
server.listen(0, "127.0.0.1", () => {
  fs.appendFileSync(path.join(__dirname, "pids"), process.pid + "\\n");
  const banner = recorded.banner
    .replaceAll("<port>", String(server.address().port))
    .replaceAll("<token>", "${TOKEN}");
  process.stdout.write(banner);
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`;
  const executable = join(dir, "probe-host");
  await writeFile(executable, script);
  await chmod(executable, 0o755);
  return {
    pids: async () => {
      const text = await readFile(join(dir, "pids"), "utf-8").catch(() => "");
      return text.split("\n").filter(Boolean).map(Number);
    },
  };
}

/** Whether a process is still there. */
export function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
