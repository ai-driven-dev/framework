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
