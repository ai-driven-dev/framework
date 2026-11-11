import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { getToolConfig, isAiTool } from "../../../src/contexts/tools/domain/registry.js";
import { VALID_TOOL_IDS } from "../../../src/kernel/tool.js";
import { REPOSITORY_ROOT } from "../../helpers/repository-root.js";

/**
 * Adding a tool that runs hooks costs one descriptor, `profiles/<tool>/hooks.ts`, and one
 * payload the tool was seen sending, under the repository's hook-payload fixtures. A tool that
 * runs no hook has neither.
 */

// Resolved beside this file, never from the repository root: a profile loaded from another copy
// of the package registers into that copy's registry, which this test does not read.
const PROFILES = join(import.meta.dirname, "..", "..", "..", "src/contexts/tools/domain/profiles");
const PAYLOADS = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures", "hook-payloads");

async function acceptsHooks(toolId: string): Promise<boolean> {
  await import(pathToFileURL(join(PROFILES, toolId, "profile.ts")).href);
  const config = getToolConfig(toolId as Parameters<typeof getToolConfig>[0]);
  if (!isAiTool(config)) return false;
  const capabilities = config.capabilities as { plugins?: { acceptsHooks: boolean } };
  return capabilities.plugins?.acceptsHooks === true;
}

describe("each tool's hooks descriptor", () => {
  it.each(VALID_TOOL_IDS)("%s has a descriptor exactly when it runs hooks", async (toolId) => {
    const descriptor = join(PROFILES, toolId, "hooks.ts");

    expect(existsSync(descriptor), `${toolId}: profiles/${toolId}/hooks.ts`).toBe(
      await acceptsHooks(toolId)
    );
  });

  it.each(VALID_TOOL_IDS)("%s's descriptor is exported under the tool's name", async (toolId) => {
    if (!(await acceptsHooks(toolId))) return;
    const name = `${toolId.toUpperCase()}_HOOKS`;
    const module = (await import(pathToFileURL(join(PROFILES, toolId, "hooks.ts")).href)) as Record<
      string,
      unknown
    >;

    expect(module[name], `${toolId}: ${name} in profiles/${toolId}/hooks.ts`).toBeDefined();
  });

  it.each(VALID_TOOL_IDS)("%s's descriptor comes with a captured payload", async (toolId) => {
    if (!existsSync(join(PROFILES, toolId, "hooks.ts"))) return;
    const payloads = readdirSync(PAYLOADS).filter(
      (file) => file.startsWith(`${toolId}-`) && file.endsWith(".json")
    );

    expect(payloads.length, `${toolId}: no payload fixture named ${toolId}-*.json`).toBeGreaterThan(
      0
    );
  });

  it("reads at least one tool that runs hooks and one that runs none", async () => {
    const answers = await Promise.all(VALID_TOOL_IDS.map(acceptsHooks));

    expect(answers).toContain(true);
    expect(answers).toContain(false);
  });
});
