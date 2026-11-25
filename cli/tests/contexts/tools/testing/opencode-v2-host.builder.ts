/**
 * A fake OpenCode 2 host for the bridge's `setup` entrypoint: it records the hooks the plugin
 * registers, calls them with what OpenCode 2.4.1 really sent, and answers the session calls the
 * bridge makes as that host did.
 */

import { setTimeout as delay } from "node:timers/promises";
import { descriptorOf } from "./bridged-hosts.builder.js";
import { capturedSamples, captureFile } from "./hook-payload-captures.builder.js";
import type { Workspace } from "./hooks-runtime-bridges.builder.js";

const HOST = "opencode-v2";

/** The payloads OpenCode 2 handed its `hook` in the captured `run`, in the order it sent them,
 * the scrubbed project folder pointed at a real one. */
export function v2Payloads<T = Record<string, unknown>>(
  hook: string,
  run: string,
  project: string
): T[] {
  return capturedSamples<T>(captureFile(HOST, hook), project)
    .filter((sample) => sample.run === run)
    .map((sample) => sample.payload);
}

/** The first payload of `hook` in `run`. */
export function v2Payload<T = Record<string, unknown>>(
  hook: string,
  run: string,
  project: string
): T {
  const [first] = v2Payloads<T>(hook, run, project);
  if (first === undefined) throw new Error(`${captureFile(HOST, hook)} has no ${run} sample`);
  return first;
}

export interface Synthetic {
  readonly sessionID: string;
  readonly text: string;
  readonly delivery: string;
}

type Hook = (input: unknown) => Promise<void>;

/** Loads the bridge as OpenCode 2 does, through its descriptor's `setup`, in the workspace's
 * project. A synthetic message is admitted `admitAfter` ms after the bridge sends it, as a real
 * host's call takes a while, or refused with `refusal`. */
export async function setupV2(
  ws: Workspace,
  { admitAfter = 0, refusal }: { readonly admitAfter?: number; readonly refusal?: Error } = {}
) {
  const hooks = new Map<string, Hook>();
  const register = (domain: string) => async (name: string, callback: Hook) => {
    hooks.set(`${domain}.${name}`, callback);
    return { dispose: async () => undefined };
  };
  const sessions = [
    ...v2Payloads<{ id: string }>("session.get", "log", ws.project),
    ...v2Payloads<{ id: string }>("session.get", "child", ws.project),
  ];
  const admitted: Synthetic[] = [];
  const ctx = {
    location: { directory: ws.project },
    tool: { hook: register("tool") },
    session: {
      hook: register("session"),
      get: async ({ sessionID }: { sessionID: string }) => sessions.find((s) => s.id === sessionID),
      synthetic: async (input: Synthetic) => {
        await delay(admitAfter);
        if (refusal !== undefined) throw refusal;
        admitted.push(input);
        return v2Payload("session.synthetic", "log", ws.project);
      },
    },
  };
  const { setup } = await descriptorOf<{ setup: (ctx: unknown) => Promise<unknown> }>(ws.module);
  await setup(ctx);
  /** Calls the hook the plugin registered under `name` (`tool.execute.before`,
   * `session.prompt`, ...) with `payload`, and hands the payload back as the hook left it. */
  const call = async <T>(name: string, payload: T): Promise<T> => {
    const hook = hooks.get(name);
    if (hook === undefined) throw new Error(`the plugin registered no ${name} hook`);
    await hook(payload);
    return payload;
  };
  return { call, admitted };
}
