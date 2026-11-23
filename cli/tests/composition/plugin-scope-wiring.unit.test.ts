import { describe, expect, it } from "vitest";
import { wireInstallation } from "../../src/composition/contexts/installation.js";
import { wirePlugin } from "../../src/composition/orchestration/plugin.js";
import { wireBase } from "../../src/composition/shared.js";
import { InvalidPluginScopeError } from "../../src/contexts/installation/domain/installation.error.js";
import { InteractiveOnlyError } from "../../src/orchestration/orchestration.error.js";
import type { Scope } from "../../src/shared/domain/scope.js";
import { registeredTools, TOOL } from "../shared/testing/registered-tools.builder.js";

/** Building the graph reads nothing: the root names a project that is never opened. */
const ROOT = "/aidd-scope-wiring-unopened";

function installPlugin() {
  const base = wireBase({ projectRoot: ROOT, verbose: false, tools: registeredTools() });
  return wirePlugin(base, wireInstallation(base)).pluginInstallUseCase;
}

const install = (toolId: typeof TOOL.claude, scope: Scope) =>
  installPlugin().execute({
    pluginArg: undefined,
    toolIds: [toolId],
    projectRoot: ROOT,
    interactive: false,
    scope,
  });

describe("the scope a plugin install is checked against, as the composition wires it", () => {
  it("is the scope the tool's own profile asks for: a project-scope tool refuses the user scope", async () => {
    await expect(install(TOOL.claude, "user")).rejects.toThrow(InvalidPluginScopeError);
  });

  it("is the scope the tool's own profile asks for: a user-scope tool refuses the project scope", async () => {
    await expect(install(TOOL.cursor, "project")).rejects.toThrow(InvalidPluginScopeError);
  });

  it("lets the scope each tool supports through to the install itself", async () => {
    await expect(install(TOOL.claude, "project")).rejects.toThrow(InteractiveOnlyError);
    await expect(install(TOOL.cursor, "user")).rejects.toThrow(InteractiveOnlyError);
  });
});
