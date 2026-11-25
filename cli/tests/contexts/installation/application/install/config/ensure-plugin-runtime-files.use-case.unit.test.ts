import { describe, expect, it } from "vitest";
import { EnsurePluginRuntimeFiles } from "../../../../../../src/contexts/installation/application/install/config/ensure-plugin-runtime-files.use-case.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import type { RuntimeConfigSection } from "../../../../../../src/contexts/installation/ports/tool-sections.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const ROOT = "/proj";
const RUNTIME_FILE = ".tool/events.js";
const ASSET = { events: true };

function profile(): Pick<RuntimeConfigSection, "toolId" | "runtimeFiles"> {
  return {
    toolId: TOOL.opencode,
    runtimeFiles: () => ({ "events.js": RUNTIME_FILE }),
  };
}

async function ensure(files: Record<string, string>) {
  const fs = new InMemoryFileAdapter(files);
  const manifest = Manifest.create();
  manifest.addTool(TOOL.opencode, "1.0.0", []);
  await new EnsurePluginRuntimeFiles({ fs, assets: { loadConfigAsset: () => ASSET } }).execute(
    profile(),
    ROOT,
    manifest
  );
  return { fs, manifest };
}

describe("ensuring a tool's plugin runtime files", () => {
  it("writes a missing runtime file from its asset and records its hash", async () => {
    const { fs, manifest } = await ensure({});
    const content = JSON.stringify(ASSET, null, 2);

    expect(await fs.readFile(`${ROOT}/${RUNTIME_FILE}`)).toBe(content);
    expect(manifest.getToolFiles(TOOL.opencode).map((f) => [f.relativePath, f.hash])).toStrictEqual(
      [[RUNTIME_FILE, FileHash.of(content)]]
    );
  });

  it("leaves a runtime file already on disk unwritten and unclaimed", async () => {
    const { fs, manifest } = await ensure({ [`${ROOT}/${RUNTIME_FILE}`]: "// mine" });

    expect(await fs.readFile(`${ROOT}/${RUNTIME_FILE}`)).toBe("// mine");
    expect(manifest.getToolFiles(TOOL.opencode)).toStrictEqual([]);
  });
});
