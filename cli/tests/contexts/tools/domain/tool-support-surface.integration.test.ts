// Capture the snapshot by running this file with `UPDATE_TOOL_SUPPORT_GOLDEN=1`.
// `docs/COMPATIBILITY.md` is rendered from the stored file by `scripts/sync-compatibility.mjs`.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import "../../../../src/contexts/tools/domain/profiles/vscode/profile.js";
import type { ArtifactContract } from "../../../../src/contexts/tools/domain/build-contract.js";
import {
  buildContractFor,
  getAiToolConfig,
  nativeActivationOf,
  resolvePluginsCapability,
} from "../../../../src/contexts/tools/domain/registry.js";
import { AI_TOOL_IDS } from "../../../../src/kernel/tool.js";
import { REPOSITORY_ROOT } from "../../../helpers/repository-root.js";

const SNAPSHOT_FILE = join(REPOSITORY_ROOT, "cli/tests/golden/snapshots/tool-support/surface.json");

const SURFACES = ["skills", "agents", "mcp", "hooks", "rules", "commands"] as const;
type Surface = (typeof SURFACES)[number];

/** `no` is a surface the build contract declares unsupported; `bridge` is a hooks surface a
 * tool reaches through a generated event bridge instead of a hooks file of its own. */
type Support = "yes" | "bridge" | "no";

interface ToolSupport {
  id: string;
  name: string;
  directory: string;
  pluginMode: string | null;
  /** The tool's own CLI that `aidd` drives to register plugins, or null. */
  nativeCli: string | null;
  /** What `aidd translate` emits, per output layout the tool supports. */
  builds: Record<string, Record<Surface, Support>>;
}

function supportOf(surface: Surface, contract: ArtifactContract): Support {
  if (!contract.supported) return "no";
  if (surface === "hooks" && contract.skipHooksJson === true && contract.hooksBridge) {
    return "bridge";
  }
  return "yes";
}

function capture(): ToolSupport[] {
  return AI_TOOL_IDS.map((id) => {
    const tool = getAiToolConfig(id);
    const builds: ToolSupport["builds"] = {};
    for (const mode of ["marketplace", "flat"] as const) {
      const contract = buildContractFor(id, mode)?.();
      if (contract === undefined) continue;
      builds[mode] = Object.fromEntries(
        SURFACES.map((surface) => [surface, supportOf(surface, contract.artifacts[surface])])
      ) as Record<Surface, Support>;
    }
    return {
      id,
      name: tool.displayName,
      directory: tool.directory,
      pluginMode: resolvePluginsCapability(id)?.mode ?? null,
      nativeCli: nativeActivationOf(id)?.binary ?? null,
      builds,
    };
  });
}

describe("tool support surface", () => {
  it("matches the stored record of what each tool is declared to support", async () => {
    const captured = capture();

    if (process.env.UPDATE_TOOL_SUPPORT_GOLDEN === "1") {
      await mkdir(dirname(SNAPSHOT_FILE), { recursive: true });
      await writeFile(SNAPSHOT_FILE, `${JSON.stringify(captured, null, 2)}\n`, "utf-8");
      return;
    }

    const stored: unknown = JSON.parse(await readFile(SNAPSHOT_FILE, "utf-8"));
    expect(captured).toEqual(stored);
  });
});
