import { describe, expect, it } from "vitest";
import { FlatTargetExistsError } from "../../../../../src/contexts/translate/contract/translate.error.js";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../../../../src/shared/domain/materialization/build-contract.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  STUB_HOOKS,
  STUB_OUT,
  STUB_PLUGIN_SRC,
  stubContract,
  stubWrite,
  supportedArtifact,
  writtenUnder,
} from "../../testing/flat-writer-world.builder.js";

describe("the hooks a flat layout writes", () => {
  const hooksJson = '{ "hooks": { "PreToolUse": [] } }';

  function hooksFs(): InMemoryFileAdapter {
    return new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/hooks/hooks.json`]: hooksJson,
      [`${STUB_PLUGIN_SRC}/hooks/lib/check.sh`]: "#!/bin/sh\n",
    });
  }

  function fileArtifact(shared: boolean): ArtifactContract {
    return supportedArtifact(STUB_HOOKS, {
      hooksFile: {
        at: shared ? { shared: ".stub/settings.json" } : { own: ".stub/hooks/" },
        merge: (existing, { json, plugin }) => ({
          content: `${existing ?? "none"}+${plugin}:${json}`,
          warnings: ["one event has no equivalent"],
        }),
      },
    });
  }

  function withHooks(hooks: ArtifactContract): ToolBuildContract {
    return stubContract({ artifacts: { ...stubContract().artifacts, hooks } });
  }

  it("writes the plugin's own hooks file from nothing, and every script beside it", async () => {
    const memFs = hooksFs();
    memFs.setFile(`${STUB_OUT}/.stub/hooks/aidd-test.hooks.json`, "stale");
    expect(await stubWrite(memFs, withHooks(fileArtifact(false)), undefined, true)).toBe(2);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/hooks/aidd-test.hooks.json`]: `none+aidd-test:${hooksJson}`,
      [`${STUB_OUT}/.stub/hooks/aidd-test/lib/check.sh`]: "#!/bin/sh\n",
    });
  });

  it("refuses to overwrite the plugin's own hooks file unless forced", async () => {
    const memFs = hooksFs();
    memFs.setFile(`${STUB_OUT}/.stub/hooks/aidd-test.hooks.json`, "stale");
    await expect(stubWrite(memFs, withHooks(fileArtifact(false)))).rejects.toThrow(
      FlatTargetExistsError
    );
  });

  it("merges into the shared file the layout names, reporting what the merge said", async () => {
    const memFs = hooksFs();
    memFs.setFile(`${STUB_OUT}/.stub/settings.json`, "{}");
    const logger = new CapturingLogger();
    await stubWrite(memFs, withHooks(fileArtifact(true)), logger);
    expect(memFs.getFile(`${STUB_OUT}/.stub/settings.json`)).toBe(`{}+aidd-test:${hooksJson}`);
    expect(logger.warnMessages).toEqual(["one event has no equivalent"]);
  });

  it("merges into a shared file not written yet as into nothing", async () => {
    const memFs = hooksFs();
    await stubWrite(memFs, withHooks(fileArtifact(true)));
    expect(memFs.getFile(`${STUB_OUT}/.stub/settings.json`)).toBe(`none+aidd-test:${hooksJson}`);
  });

  it("writes only the scripts for a layout whose tool reads no hooks file", async () => {
    const memFs = hooksFs();
    expect(await stubWrite(memFs, stubContract())).toBe(1);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/hooks/aidd-test/lib/check.sh`]: "#!/bin/sh\n",
    });
  });

  it("generates the bridge a layout with no manifest of its own declares", async () => {
    const memFs = hooksFs();
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        hooks: supportedArtifact(STUB_HOOKS, {
          skipHooksJson: true,
          hooksBridge: {
            generate: (raw, plugin) => ({ content: `bridge(${plugin}):${raw}`, warnings: [] }),
            dir: ".stub/plugin/",
            skipIfSourceHas: "own-plugin.js",
          },
        }),
      },
    });
    expect(await stubWrite(memFs, contract)).toBe(2);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/plugin/aidd-test-hooks.js`]: `bridge(aidd-test):${hooksJson}`,
      [`${STUB_OUT}/.stub/hooks/aidd-test/lib/check.sh`]: "#!/bin/sh\n",
    });
  });

  it("generates none where the bridge maps nothing the plugin declared", async () => {
    const memFs = hooksFs();
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        hooks: supportedArtifact(STUB_HOOKS, {
          skipHooksJson: true,
          hooksBridge: {
            generate: () => ({ content: null, warnings: [] }),
            dir: ".stub/plugin/",
            skipIfSourceHas: "own-plugin.js",
          },
        }),
      },
    });
    expect(await stubWrite(memFs, contract)).toBe(1);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/hooks/aidd-test/lib/check.sh`]: "#!/bin/sh\n",
    });
  });

  it("generates no bridge for a plugin shipping its own", async () => {
    const memFs = hooksFs();
    memFs.setFile(`${STUB_PLUGIN_SRC}/hooks/own-plugin.js`, "export const plugin = () => {};\n");
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        hooks: supportedArtifact(STUB_HOOKS, {
          skipHooksJson: true,
          hooksBridge: {
            generate: (raw, plugin) => ({ content: `bridge(${plugin}):${raw}`, warnings: [] }),
            dir: ".stub/plugin/",
            skipIfSourceHas: "own-plugin.js",
          },
        }),
      },
    });
    expect(await stubWrite(memFs, contract)).toBe(2);
    expect(memFs.has(`${STUB_OUT}/.stub/plugin/aidd-test-hooks.js`)).toBe(false);
  });

  it("writes nothing for a plugin shipping no hooks manifest", async () => {
    const memFs = new InMemoryFileAdapter({ [`${STUB_PLUGIN_SRC}/README.md`]: "# H" });
    expect(await stubWrite(memFs, stubContract())).toBe(0);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({});
  });

  it("says once that a layout hosting no hook skips the plugin's own", async () => {
    const memFs = hooksFs();
    const logger = new CapturingLogger();
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        hooks: { supported: false, reason: "off in this test" },
      },
    });
    expect(await stubWrite(memFs, contract, logger)).toBe(0);
    expect(logger.warnMessages).toEqual([
      "Skipping hooks/ in plugin 'aidd-test' (hooks not supported for this target).",
    ]);
  });
});
