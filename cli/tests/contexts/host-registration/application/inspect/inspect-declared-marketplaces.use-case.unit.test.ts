import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InspectDeclaredMarketplaces } from "../../../../../src/contexts/host-registration/application/inspect/inspect-declared-marketplaces.use-case.js";
import { BUILT_CACHE_SUBDIR } from "../../../../../src/shared/domain/layout/aidd-layout.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const SETTINGS = "/project/.claude/settings.local.json";
const NAME = "aidd-framework";

function inspector(
  options: {
    settings?: string;
    hostAvailable?: boolean;
    settingsFile?: string;
    platform?: string;
  } = {}
) {
  const fs = new InMemoryFileAdapter();
  if (options.settings !== undefined)
    fs.setFile(options.settingsFile ?? SETTINGS, options.settings);
  return new InspectDeclaredMarketplaces(
    fs,
    () => options.hostAvailable ?? true,
    options.platform ?? "linux",
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
  toolId: string = TOOL.claude
) {
  return subject.execute({ projectRoot: "/project", toolId, marketplaceNames });
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

  it("names the settings file as unparseable, with the reason, instead of reporting each marketplace missing", async () => {
    const result = await inspect(inspector({ settings: "{ not json" }), [NAME, "second"]);

    expect(result.findings).toEqual([]);
    expect(result.stale).toEqual([]);
    expect(result.unparseable).toEqual([
      {
        tool: TOOL.claude,
        file: ".claude/settings.local.json",
        reason: expect.stringMatching(/\S/),
      },
    ]);
  });

  it.each(["null", "[]", "5"])(
    "names a settings file whose root is %s as unparseable",
    async (root) => {
      const { findings, unparseable } = await inspect(inspector({ settings: root }));

      expect(findings).toEqual([]);
      expect(unparseable).toEqual([
        {
          tool: TOOL.claude,
          file: ".claude/settings.local.json",
          reason: "the root is not an object",
        },
      ]);
    }
  );

  it("names nothing unparseable when the settings file is valid, absent or silent", async () => {
    for (const settings of [declaring(NAME), undefined, "{}"])
      expect((await inspect(inspector({ settings }))).unparseable).toEqual([]);
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
    const { findings } = await inspect(inspector(), [NAME], TOOL.vscode);

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

    it("names a declaration under a windows project root spelled in another case", async () => {
      const root = "C:\\Proj";
      const builtTree = "c:\\proj\\.aidd\\cache\\built\\local\\claude";
      const subject = inspector({
        settings: declaringSource(NAME, builtTree),
        settingsFile: join(root, ".claude", "settings.local.json"),
        platform: "win32",
      });

      const { stale } = await subject.execute({
        projectRoot: root,
        toolId: TOOL.claude,
        marketplaceNames: [],
      });

      expect(stale).toHaveLength(1);
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
