import { type ChildProcess, spawn } from "node:child_process";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { RegistrationRefusedError } from "../../contract/host-registration.error.js";
import type { PluginServerSpec } from "../../contract/native-registration-spec.js";
import { type ServerEndpoint, serverEndpointIn } from "../../domain/server/server-banner.js";
import {
  type ServerInstallation,
  type ServerPlugin,
  serverPluginOf,
} from "../../domain/server/server-plugin.js";
import { type ServerReply, serverReplyOf } from "../../domain/server/server-reply.js";
import type { HostPluginServer } from "../../ports/server/host-plugin-server.js";
import type { PluginServerSession } from "../../ports/server/plugin-server-session.js";
import {
  HOST_COMMAND_TIMEOUT_MS,
  hostExecutableLookup,
  resolveExecutableOnPath,
} from "../executable-on-path.js";

const STOP_GRACE_MS = 5000;

/** Starts a host's own server for the length of one piece of work and stops it after, so nothing
 * is left listening. Everything that differs between hosts comes from the declared spec. */
export class PluginServerAdapter implements HostPluginServer {
  constructor(private readonly spec: PluginServerSpec) {}

  isAvailable(): boolean {
    return resolveExecutableOnPath(this.spec.binary, hostExecutableLookup()) !== undefined;
  }

  async withSession<T>(use: (session: PluginServerSession) => Promise<T>): Promise<T> {
    const child = spawn(this.spec.binary, [...this.spec.args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = new Promise<void>((resolve) => child.once("close", () => resolve()));
    try {
      const endpoint = await endpointOf(child, this.spec);
      return await use(sessionOver(this.spec, endpoint));
    } finally {
      await stop(child, exited);
    }
  }
}

function refusal(spec: PluginServerSpec, reason: string): RegistrationRefusedError {
  return new RegistrationRefusedError(`${spec.binary} server ${reason}.`);
}

/** Where the server listens, once its banner is whole. What it prints is read for its endpoint and
 * kept nowhere, because that is where the token is. Refused when the process ends or the wait runs
 * out first. */
function endpointOf(child: ChildProcess, spec: PluginServerSpec): Promise<ServerEndpoint> {
  return new Promise((resolve, reject) => {
    let output = "";
    const settle = (done: () => void): void => {
      clearTimeout(timer);
      done();
    };
    const timer = setTimeout(
      () => reject(refusal(spec, "did not report where it listens in time")),
      HOST_COMMAND_TIMEOUT_MS
    );
    const read = (chunk: Buffer): void => {
      output += chunk.toString();
      const endpoint = serverEndpointIn(output, spec.bannerPattern);
      if (endpoint !== undefined) settle(() => resolve(endpoint));
    };
    child.stdout?.on("data", read);
    child.stderr?.on("data", read);
    child.once("error", (cause) => settle(() => reject(refusal(spec, cause.message))));
    child.once("close", () =>
      settle(() => reject(refusal(spec, "exited before it reported where it listens")))
    );
  });
}

/** Ends the process and waits for it to be gone. */
async function stop(child: ChildProcess, exited: Promise<void>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const forced = setTimeout(() => child.kill("SIGKILL"), STOP_GRACE_MS);
  await exited;
  clearTimeout(forced);
}

/** The plugin calls of a running host server, over HTTP with the token it printed as a bearer. */
function sessionOver(spec: PluginServerSpec, endpoint: ServerEndpoint): PluginServerSession {
  const send = async (method: "GET" | "POST", path: string, body?: unknown) => {
    const response = await fetch(`${endpoint.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${endpoint.token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(HOST_COMMAND_TIMEOUT_MS),
    });
    return serverReplyOf(response.status, await response.text());
  };
  const answered = (what: string, reply: ServerReply): unknown => {
    if (reply.kind === "refused") {
      throw new RegistrationRefusedError(`${spec.binary} ${what} refused: ${reply.detail}`);
    }
    return reply.data;
  };
  return {
    async list(): Promise<readonly ServerPlugin[]> {
      const reply = await send("GET", spec.pluginsPath);
      const plugins = asPlainObject(answered("list plugins", reply))?.plugins;
      return Array.isArray(plugins) ? plugins.map(serverPluginOf) : [];
    },
    async install(directory: string): Promise<ServerInstallation> {
      const reply = await send("POST", spec.pluginsPath, { source: directory });
      if (reply.kind === "refused") {
        return {
          refusal: { detail: `${spec.binary} install ${directory} refused: ${reply.detail}` },
        };
      }
      return { plugin: serverPluginOf(reply.data) };
    },
    async remove(id: string): Promise<void> {
      const reply = await send("POST", `${spec.pluginsPath}/${id}:remove`);
      if (reply.kind === "refused" && reply.code === spec.notInstalledCode) return;
      answered(`remove ${id}`, reply);
    },
  };
}
