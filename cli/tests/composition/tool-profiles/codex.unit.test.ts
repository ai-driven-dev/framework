import { describe, expect, it } from "vitest";
import { codexSpec } from "../../../src/composition/tool-profiles/codex.js";
import { artifactPath } from "../../../src/contexts/tools/contract/artifact-path.js";
import { defineAiTool } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { SmolTomlCodec } from "../../../src/shared/infrastructure/smol-toml-codec.adapter.js";
import {
  PLUGIN_TREE_SOURCES,
  supported,
} from "../../contexts/tools/testing/build-artifacts.builder.js";
import {
  contractOf,
  marketplaceSourcesOf,
} from "../../contexts/tools/testing/profile-tables.builder.js";

const codex = defineAiTool(codexSpec, { toml: new SmolTomlCodec() });

describe("codex build and conversion tables", () => {
  it("sources the plugin tree as it ships, and stages an agent named with an inner .md as .toml", () => {
    expect(marketplaceSourcesOf(codex)).toStrictEqual(PLUGIN_TREE_SOURCES);
    expect(
      artifactPath(
        supported(contractOf(codex, "marketplace").artifacts.agents),
        "aidd-dev",
        "agents/notes.md-helper.md"
      )
    ).toBe("codex-agents/notes.md-helper.toml");
  });
});
