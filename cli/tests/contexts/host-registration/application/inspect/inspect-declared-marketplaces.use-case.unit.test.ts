import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InspectDeclaredMarketplaces } from "../../../../../src/contexts/host-registration/application/inspect/inspect-declared-marketplaces.use-case.js";
import { BUILT_CACHE_SUBDIR } from "../../../../../src/shared/domain/layout/aidd-layout.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const SETTINGS = "/project/.claude/settings.local.json";
const NAME = "aidd-framework";

function inspector(options: { settings?: string; hostAvailable?: boolean } = {}) {
  const fs = new InMemoryFileAdapter();
  if (options.settings !== undefined) fs.setFile(SETTINGS, options.settings);
  return new InspectDeclaredMarketplaces(
    fs,
    () => options.hostAvailable ?? true,
    registeredTools()
  );
}

function declaring(...names: string[]): string {
  return JSON.stringify({
    extraKnownMarketplaces: Object.fromEntries(names.map((name) => [name, { source: {} }])),
  });
}

function declaringSource(name: string, path: string): string {
  return JSON.stringify({
    extraKnownMarketplaces: { [name]: { source: { source: "directory", path } } },
  });
}

const BUILT_TREE = join("/project", BUILT_CACHE_SUBDIR, "local", "claude");

function inspect(
  subject: InspectDeclaredMarketplaces,
  marketplaceNames: readonly string[] = [NAME],
  toolIds: readonly string[] = [TOOL.claude]
) {
  return subject.execute({ projectRoot: "/project", toolIds, marketplaceNames });
}

describe("inspecting the marketplaces a tool's machine-local settings declare", () => {
  it("names a marketplace the settings file no longer declares, and where it was expected", async () => {
    const { findings } = await inspect(inspector({ settings: declaring("another") }));

    expect(findings).toEqual([
      { tool: TOOL.claude, name: NAME, file: ".claude/settings.local.json" },
    ]);
  });

  it("reports nothing when the settings file declares it", async () => {
    const { findings } = await inspect(inspector({ settings: declaring(NAME) }));

    expect(findings).toEqual([]);
  });

  it("reports every marketplace when the settings file is gone", async () => {
    const { findings } = await inspect(inspector(), [NAME, "second"]);

    expect(findings.map((finding) => finding.name)).toEqual([NAME, "second"]);
  });

  it("reports the marketplace when the settings file is not valid JSON", async () => {
    const { findings } = await inspect(inspector({ settings: "{ not json" }));

    expect(findings).toHaveLength(1);
  });

  it("reports nothing when the project registers no marketplace", async () => {
    const { findings } = await inspect(inspector(), []);

    expect(findings).toEqual([]);
  });

  it("reports nothing for a tool whose own CLI cannot have written the registration", async () => {
    const { findings } = await inspect(inspector({ hostAvailable: false }));

    expect(findings).toEqual([]);
  });

  it("reports nothing for a tool that keeps no machine-local registration", async () => {
    const { findings } = await inspect(inspector(), [NAME], [TOOL.vscode]);

    expect(findings).toEqual([]);
  });

  describe("a declaration the project no longer registers", () => {
    it("names a marketplace the settings file declares from this project's built cache and no registered marketplace owns", async () => {
      const { stale } = await inspect(
        inspector({ settings: declaringSource(NAME, BUILT_TREE) }),
        []
      );

      expect(stale).toEqual([
        { tool: TOOL.claude, name: NAME, file: ".claude/settings.local.json" },
      ]);
    });

    it("keeps a declaration the project still registers", async () => {
      const { stale } = await inspect(inspector({ settings: declaringSource(NAME, BUILT_TREE) }));

      expect(stale).toEqual([]);
    });

    it("keeps a declaration that points anywhere but this project's built cache", async () => {
      const { stale } = await inspect(
        inspector({ settings: declaringSource("mine", join("/elsewhere", "marketplace")) }),
        []
      );

      expect(stale).toEqual([]);
    });
  });
});
