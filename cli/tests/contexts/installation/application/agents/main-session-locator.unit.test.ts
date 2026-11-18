import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MainSessionLocator } from "../../../../../src/contexts/installation/application/agents/main-session-locator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

const HOME = "/home/me";
const JSONC = join(HOME, ".config", "opencode", "opencode.jsonc");
const TWIN = JSONC.replace(/c$/, "");

function locator(fs = new InMemoryFileAdapter()) {
  return new MainSessionLocator(fs, () => HOME, { get: () => undefined }, registeredTools());
}

describe("MainSessionLocator", () => {
  it("reads the JSONC config when the JSON twin is there too", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(JSONC, "{}");
    fs.setFile(TWIN, "{}");

    expect((await locator(fs).locate(TOOL.opencode)).path).toBe(JSONC);
  });

  it("reads the JSON twin when it alone exists", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(TWIN, "{}");

    expect((await locator(fs).locate(TOOL.opencode)).path).toBe(TWIN);
  });

  it("answers no models and no path for a tool that is not an AI host", async () => {
    expect(await locator().locate(TOOL.vscode)).toStrictEqual({ models: null, path: undefined });
  });
});
