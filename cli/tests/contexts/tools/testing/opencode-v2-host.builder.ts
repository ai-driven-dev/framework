/**
 * A fake OpenCode 2 host for the bridge's `setup` entrypoint: it records the hooks the plugin
 * registers, calls them with what OpenCode 2.4.1 really sent, and answers the session calls the
 * bridge makes as that host did.
 */

import { setTimeout as delay } from "node:timers/promises";
import { descriptorOf } from "./bridged-hosts.builder.js";
import { capturedRunOf } from "./hook-payload-captures.builder.js";
import { capturedPayloads, type Workspace } from "./hooks-runtime-bridges.builder.js";

/** OpenCode 2's captured hooks, by the name it gives each. */
export const V2_HOST = "opencode-v2";

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
  const sessions = await capturedPayloads<{ id: string }>(V2_HOST, "session.get", ws.project);
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
        return capturedRunOf(V2_HOST, "log", ws.project)("session.synthetic");
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
