import { describe, expect, it } from "vitest";
import { codexSpec } from "../../../../../../src/composition/tool-profiles/codex.js";
import { TomlParseError } from "../../../../../../src/contexts/tools/contract/errors/tools.error.js";
import { defineAiTool } from "../../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { SmolTomlCodec } from "../../../../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { FlatWriter } from "../../../../../../src/contexts/translate/application/sinks/flat-writer.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { present } from "../../../../../shared/testing/present.builder.js";

const CONFIG = "/out/.codex/config.toml";
const HAND_EDITED = 'model = "o3"\n[mcp_servers.mine\ncommand = "x"\n';

async function writeCodexConfig(fs: InMemoryFileAdapter): Promise<number> {
  const contract = present(
    defineAiTool(codexSpec, { toml: new SmolTomlCodec() }).buildContracts.flat
  )();
  const writer = new FlatWriter(fs, { loadConfigAsset: () => ({}) }, new CapturingLogger());
  return writer.writeConfig({ contract, force: false, outDir: "/out" }, [{ name: "plug" }]);
}

describe("a flat build merging into the config.toml a person already keeps", () => {
  it("keeps the person's file and settings", async () => {
    const fs = new InMemoryFileAdapter({ [CONFIG]: 'model = "o3"\n' });

    await writeCodexConfig(fs);

    expect(fs.getFile(CONFIG)).toContain('model = "o3"');
  });

  it("refuses a file that is not TOML, and leaves it as it was", async () => {
    const fs = new InMemoryFileAdapter({ [CONFIG]: HAND_EDITED });

    await expect(writeCodexConfig(fs)).rejects.toBeInstanceOf(TomlParseError);
    expect(fs.getFile(CONFIG)).toBe(HAND_EDITED);
  });
});
