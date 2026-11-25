/**
 * OpenCode and Kilo send a hook nothing on stdin: a plugin receives arguments, and the bridge
 * generated for it runs the hook with a payload of its own. Their adapter reads that payload,
 * so each captured argument goes through the real bridge into a hook that speaks only the
 * neutral interface, with the adapter where the build puts it.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADAPTERS,
  captured,
  cleanWorkspaces,
  FAILING,
  kiloBridge,
  opencodeBridge,
  RECORD,
  recorded,
  SILENT,
  start,
  startedWith,
  startingWith,
  UNSPAWNABLE,
  workspace,
} from "./testing/hooks-runtime-bridges.builder.js";

afterEach(cleanWorkspaces);

describe.each(["opencode", "kilo"] as const)("SessionStart answers on %s", (host) => {
  it("joins several answers into one entry, a blank line apart", async () => {
    const { added } = await startedWith(host, startingWith(RECORD, RECORD));

    expect(added).toStrictEqual(["start note\n\nstart note"]);
  });

  it("leaves a silent script out of the entry, with no separator left behind", async () => {
    const { added } = await startedWith(host, startingWith(SILENT, RECORD));

    expect(added).toStrictEqual(["start note"]);
  });

  it("adds nothing, and does not throw, when a script cannot be spawned", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { added } = await startedWith(host, startingWith(UNSPAWNABLE, RECORD));

    expect(added).toStrictEqual(["start note"]);
  });

  it("keeps the answer of the scripts that ran when another one fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { added } = await startedWith(host, startingWith(FAILING, RECORD));

    expect(added).toStrictEqual(["start note"]);
  });
});

describe.each([
  ["opencode", "OpenCode"],
  ["kilo", "Kilo"],
] as const)("a failed SessionStart script on %s", (host, label) => {
  it("is reported once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await startedWith(host, startingWith(FAILING));

    expect(warn.mock.calls.map(([line]) => String(line))).toStrictEqual([
      expect.stringMatching(
        new RegExp(`^\\[aidd\\] ${label} hook .*fail\\.cjs failed: exited with code 1$`)
      ),
    ]);
  });
});

describe("the adapter both bridged hosts share", () => {
  it("is one source, read as opencode behind the OpenCode bridge and as kilo behind the Kilo bridge", async () => {
    const opencode = await workspace("opencode", opencodeBridge());
    const [created] = await captured("opencode-session.created.json", opencode.project);
    const started = await start(opencode, { directory: opencode.dir });
    await started.plugin.event({ event: created });
    const kilo = await workspace("kilo", kiloBridge());
    const [session] = await captured("kilo-session.created.json", kilo.project);
    const { plugin } = await start(kilo, { directory: kilo.dir });
    await plugin.event({ event: session });

    const unstamped = (adapter: string) => adapter.replace(/^const HOST = .*$/m, "");
    expect(unstamped(ADAPTERS.opencode)).toBe(unstamped(ADAPTERS.kilo));
    expect((await recorded(opencode, 1)).map((call) => call.host)).toStrictEqual(["opencode"]);
    expect((await recorded(kilo, 1)).map((call) => call.host)).toStrictEqual(["kilo"]);
  });
});
