import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { codexMarketplaceSourceListContract } from "../../../../src/contexts/tools/domain/profiles/codex/native-marketplace-source.js";
import { copilotMarketplaceSourceListContract } from "../../../../src/contexts/tools/domain/profiles/copilot/native-marketplace-source.js";
import {
  HostRegistryMarketplaceSourceReaderAdapter,
  NativeMarketplaceSourceReaderAdapter,
} from "../../../../src/contexts/tools/infrastructure/native-marketplace-source-reader-adapter.js";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
const spawn = vi.mocked(spawnSync);

function result(stdout: string, status = 0, stderr = "") {
  return {
    pid: 1,
    output: [],
    stdout,
    stderr,
    status,
    signal: null,
    error: undefined,
  } as ReturnType<typeof spawnSync>;
}

describe("native marketplace source reader", () => {
  it("maps Claude's readable marketplace registry to exact file sources", async () => {
    const reader = new HostRegistryMarketplaceSourceReaderAdapter({
      read: async () => ({
        location: "/home/.claude/plugins/known_marketplaces.json",
        entries: new Map([["aidd-framework", "/project-a/.aidd/cache/built"]]),
      }),
    });

    const reading = await reader.read("/project-b");

    expect(reading.entries?.get("aidd-framework")).toEqual({
      kind: "registry",
      source: "/project-a/.aidd/cache/built",
    });
  });

  it("distinguishes Claude's missing registry from an unreadable one", async () => {
    for (const [hostReading, expected] of [
      [{ location: "/known", absent: true as const }, "absent"],
      [{ location: "/known", unreadable: "EACCES" }, "unreadable"],
    ] as const) {
      const reading = await new HostRegistryMarketplaceSourceReaderAdapter({
        read: async () => hostReading,
      }).read("/project-b");

      if (expected === "absent") expect(reading.entries?.size).toBe(0);
      else expect(reading.unreadable).toContain("EACCES");
    }
  });

  it("reads Codex's effective configured source with the requesting project's CWD", async () => {
    spawn.mockReturnValue(
      result(
        JSON.stringify({
          marketplaces: [
            {
              name: "aidd-framework",
              root: "/home/.codex/plugins/marketplaces/aidd-framework",
              marketplaceSource: { sourceType: "local", source: "/project-a/.aidd/cache/built" },
            },
          ],
        })
      )
    );

    const reading = await new NativeMarketplaceSourceReaderAdapter(
      codexMarketplaceSourceListContract
    ).read("/project-b");

    expect(spawn).toHaveBeenCalledWith(
      "codex",
      ["plugin", "marketplace", "list", "--json"],
      expect.objectContaining({ cwd: "/project-b", shell: false })
    );
    expect(reading.entries?.get("aidd-framework")).toEqual({
      kind: "effective-list",
      root: "/home/.codex/plugins/marketplaces/aidd-framework",
      sourceType: "local",
      source: "/project-a/.aidd/cache/built",
    });
  });

  it("proves an empty Codex host only from a valid structured empty list", async () => {
    spawn.mockReturnValue(result('{"marketplaces":[]}'));

    const reading = await new NativeMarketplaceSourceReaderAdapter(
      codexMarketplaceSourceListContract
    ).read("/project-a");

    expect(reading.entries?.size).toBe(0);
    expect(reading.unreadable).toBeUndefined();
  });

  it("marks a named Codex row without configured source unproven", async () => {
    spawn.mockReturnValue(result('{"marketplaces":[{"name":"foreign","root":"/foreign/cache"}]}'));

    const reading = await new NativeMarketplaceSourceReaderAdapter(
      codexMarketplaceSourceListContract
    ).read("/project-a");

    expect(reading.entries?.has("foreign")).toBe(true);
    expect(reading.entries?.get("foreign")).toBeNull();
  });

  it("rejects unknown JSON shapes and duplicate host names without inferring absence", async () => {
    for (const output of [
      '{"plugins":[]}',
      '{"marketplaces":[{"name":"aidd-framework","root":7}]}',
      '{"marketplaces":[{"name":"aidd-framework","root":"/one"},{"name":"aidd-framework","root":"/two"}]}',
      "not JSON",
    ]) {
      spawn.mockReturnValue(result(output));

      const reading = await new NativeMarketplaceSourceReaderAdapter(
        codexMarketplaceSourceListContract
      ).read("/project-a");

      expect(reading.entries).toBeUndefined();
      expect(reading.unreadable).toContain("codex marketplace list");
    }
  });

  it.each([
    ["null listing", null],
    ["array listing", []],
    ["null catalogue", { marketplaces: null }],
    ["object catalogue", { marketplaces: {} }],
    ["null row", { marketplaces: [null] }],
    ["array row", { marketplaces: [[]] }],
    ["missing name", { marketplaces: [{ root: "/cache" }] }],
    ["numeric name", { marketplaces: [{ name: 7, root: "/cache" }] }],
    ["empty name", { marketplaces: [{ name: "", root: "/cache" }] }],
    ["missing root", { marketplaces: [{ name: "foreign" }] }],
    ["empty root", { marketplaces: [{ name: "foreign", root: "" }] }],
  ])("keeps Codex provenance unreadable for a %s", async (_name, payload) => {
    spawn.mockReturnValue(result(JSON.stringify(payload)));

    const reading = await new NativeMarketplaceSourceReaderAdapter(
      codexMarketplaceSourceListContract
    ).read("/project-a");

    expect(reading.entries).toBeUndefined();
    expect(reading.unreadable).toContain("codex marketplace list could not prove a source");
  });

  it.each([
    ["null source", null],
    ["array source", []],
    ["missing source type", { source: "/owned" }],
    ["numeric source type", { sourceType: 7, source: "/owned" }],
    ["empty source type", { sourceType: "", source: "/owned" }],
    ["missing source path", { sourceType: "local" }],
    ["numeric source path", { sourceType: "local", source: 7 }],
    ["empty source path", { sourceType: "local", source: "" }],
  ])("does not accept a Codex cache root as proof of a %s", async (_name, source) => {
    spawn.mockReturnValue(
      result(
        JSON.stringify({
          marketplaces: [{ name: "foreign", root: "/owned/cache", marketplaceSource: source }],
        })
      )
    );

    const reading = await new NativeMarketplaceSourceReaderAdapter(
      codexMarketplaceSourceListContract
    ).read("/project-a");

    expect(reading.entries).toBeUndefined();
    expect(reading.unreadable).toContain("codex marketplace list could not prove a source");
  });

  it("rejects the whole Codex listing when a later row has no proven source shape", async () => {
    spawn.mockReturnValue(
      result(
        JSON.stringify({
          marketplaces: [
            {
              name: "owned",
              root: "/owned/cache",
              marketplaceSource: { sourceType: "local", source: "/owned/source" },
            },
            { name: "foreign", root: "/foreign/cache", marketplaceSource: null },
          ],
        })
      )
    );

    const reading = await new NativeMarketplaceSourceReaderAdapter(
      codexMarketplaceSourceListContract
    ).read("/project-a");

    expect(reading.entries).toBeUndefined();
    expect(reading.unreadable).toContain("codex marketplace list could not prove a source");
  });

  it.each([
    ['{"plugins":[]}', "unexpected Codex JSON shape"],
    ['{"marketplaces":[{"name":"","root":"/cache"}]}', "ambiguous Codex marketplace JSON row"],
    [
      '{"marketplaces":[{"name":"foreign","root":"/cache","marketplaceSource":null}]}',
      "unproven Codex marketplace source shape",
    ],
  ])("identifies the provenance repair needed for %s", async (output, diagnosis) => {
    spawn.mockReturnValue(result(output));

    const reading = await new NativeMarketplaceSourceReaderAdapter(
      codexMarketplaceSourceListContract
    ).read("/project-a");

    expect(reading.entries).toBeUndefined();
    expect(reading.unreadable).toBe(
      `codex marketplace list could not prove a source: ${diagnosis}`
    );
  });

  it("gives an actionable Codex diagnostic without treating a failed listing as absence", async () => {
    spawn.mockReturnValue(result("", 1, "permission denied"));

    const reading = await new NativeMarketplaceSourceReaderAdapter(
      codexMarketplaceSourceListContract
    ).read("/project-a");

    expect(reading.entries).toBeUndefined();
    expect(reading.unreadable).toBe(
      "Codex marketplace list --json unavailable; inspect the host CLI and retry: permission denied"
    );
  });

  it("refuses Copilot 1.0.83's unsupported --json without a human-text fallback", async () => {
    spawn.mockReturnValue(result("", 1, "error: unknown option '--json'"));

    const reading = await new NativeMarketplaceSourceReaderAdapter(
      copilotMarketplaceSourceListContract
    ).read("/project-a");

    expect(spawn).toHaveBeenCalledWith(
      "copilot",
      ["plugin", "marketplace", "list", "--json"],
      expect.objectContaining({ cwd: "/project-a", shell: false })
    );
    expect(reading.entries).toBeUndefined();
    expect(reading.unreadable).toContain("marketplace list --json");
    expect(reading.unreadable).toContain("upgrade");
  });
});
