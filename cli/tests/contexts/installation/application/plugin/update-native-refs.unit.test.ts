import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/contexts/installation.js";
import {
  assertSelectionResolves,
  nativeTargets,
  refreshNativeRefs,
} from "../../../../../src/contexts/installation/application/plugin/update-native-refs.js";
import type { ToolRecords } from "../../../../../src/contexts/installation/contract/records/scope-records.js";
import { PluginNotFoundError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

function recordsWithRefs(...refs: string[]): ToolRecords {
  return new Map([
    [
      TOOL.codex,
      {
        binary: "codex",
        marketplaces: [],
        pluginRefs: refs,
        pluginClaims: refs.map((ref) => ({ ref, dependents: ["/A"] })),
      },
    ],
  ]);
}

const toolIds = [TOOL.codex];
const command = { projectRoot: "/A", toolIds };

describe("choosing the native refs to update", () => {
  it("lists every native ref of the selected tools when no plugin is named", () => {
    const records = recordsWithRefs("aidd-dev@aidd", "other@aidd");

    const targets = nativeTargets(registrationRecordRules, records, {
      toolIds,
      options: command,
    });

    expect(targets.map(({ claim }) => claim.ref)).toStrictEqual(["aidd-dev@aidd", "other@aidd"]);
  });

  it("narrows to the plugin named, and lists none on a rebuild", () => {
    const records = recordsWithRefs("aidd-dev@aidd", "other@aidd");

    const named = nativeTargets(registrationRecordRules, records, {
      toolIds,
      options: { ...command, pluginNames: ["other"] },
    });
    const rebuilt = nativeTargets(registrationRecordRules, records, {
      toolIds,
      options: { ...command, rebuild: true },
    });

    expect(named.map(({ claim }) => claim.ref)).toStrictEqual(["other@aidd"]);
    expect(rebuilt).toStrictEqual([]);
  });
});

describe("checking that a selection matches something", () => {
  it("refuses a named plugin that matches no file and no native ref", () => {
    expect(() =>
      assertSelectionResolves(
        registrationRecordRules,
        { ...command, pluginNames: ["absent"] },
        { files: 0, native: [] }
      )
    ).toThrow(PluginNotFoundError);
  });

  it("refuses a bare name that matches several catalogues", () => {
    const records = recordsWithRefs("aidd-dev@one", "aidd-dev@two");
    const options = { ...command, pluginNames: ["aidd-dev"] };
    const native = nativeTargets(registrationRecordRules, records, { toolIds, options });

    expect(() =>
      assertSelectionResolves(registrationRecordRules, options, { files: 0, native })
    ).toThrow("Multiple native catalogues match");
  });

  it("accepts any selection when no plugin is named", () => {
    expect(() =>
      assertSelectionResolves(registrationRecordRules, command, { files: 0, native: [] })
    ).not.toThrow();
  });
});

describe("refreshing the native refs", () => {
  it("warns about dependents, applies each refresh and returns the refs", async () => {
    const records = recordsWithRefs("aidd-dev@aidd");
    const targets = nativeTargets(registrationRecordRules, records, { toolIds, options: command });
    const logger = new CapturingLogger();
    const applied: string[] = [];

    const updated = await refreshNativeRefs(logger, registeredTools(), {
      targets,
      options: {
        ...command,
        refreshNative: async (request) => ({ apply: () => applied.push(request.ref) }),
      },
    });

    expect(updated).toStrictEqual(["aidd-dev@aidd"]);
    expect(applied).toStrictEqual(["aidd-dev@aidd"]);
    expect(logger.warnMessages[0]).toContain("affects /A");
  });
});
