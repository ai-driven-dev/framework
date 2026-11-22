import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogIdentityReader } from "../../../../../src/contexts/host-registration/infrastructure/marketplace/marketplace-registry-reader.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../../shared/testing/faulting-file-adapter.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const DIR = "/marketplace";
const CATALOG_PATH = join(DIR, ".claude-plugin", "marketplace.json");

function fsWithCatalog(catalog: unknown): InMemoryFileAdapter {
  return new InMemoryFileAdapter({ [CATALOG_PATH]: JSON.stringify(catalog) });
}

describe("catalogIdentityReader", () => {
  it("answers no identity when the declared catalog does not exist", async () => {
    expect(
      await catalogIdentityReader(new InMemoryFileAdapter()).read(
        registeredTools().profile(TOOL.claude),
        DIR
      )
    ).toBeUndefined();
  });

  it("answers no identity when the declared catalog cannot be read", async () => {
    const fs = new FaultingFileAdapter({
      [CATALOG_PATH]: JSON.stringify({ name: "aidd-framework" }),
    });
    fs.failOn("readFile", CATALOG_PATH, errnoError("EACCES"));

    expect(
      await catalogIdentityReader(fs).read(registeredTools().profile(TOOL.claude), DIR)
    ).toBeUndefined();
  });

  it.each(["not JSON", "null", '{"name":'])(
    "answers no identity for an unreadable catalog document: %s",
    async (content) => {
      const fs = new InMemoryFileAdapter({ [CATALOG_PATH]: content });

      expect(
        await catalogIdentityReader(fs).read(registeredTools().profile(TOOL.claude), DIR)
      ).toBeUndefined();
    }
  );

  it("reads OpenCode's declared catalog path even when a Claude catalog is also present", async () => {
    const fs = fsWithCatalog({ name: "other-catalog", plugins: [{ name: "other-plugin" }] });
    fs.setFile(
      join(DIR, "opencode.json"),
      JSON.stringify({ name: "opencode-catalog", plugins: [{ name: "opencode-plugin" }] })
    );

    expect(
      await catalogIdentityReader(fs).read(registeredTools().profile(TOOL.opencode), DIR)
    ).toStrictEqual({
      name: "opencode-catalog",
      pluginNames: ["opencode-plugin"],
    });
  });

  it("reads the name and plugin names the tool's own catalog file declares", async () => {
    const fs = fsWithCatalog({ name: "aidd-framework", plugins: [{ name: "a" }, { name: "b" }] });

    const identity = await catalogIdentityReader(fs).read(
      registeredTools().profile(TOOL.claude),
      DIR
    );

    expect(identity).toStrictEqual({ name: "aidd-framework", pluginNames: ["a", "b"] });
  });

  it("answers no plugin names for a catalog that declares none", async () => {
    const fs = fsWithCatalog({ name: "aidd-framework" });

    const identity = await catalogIdentityReader(fs).read(
      registeredTools().profile(TOOL.claude),
      DIR
    );

    expect(identity).toStrictEqual({ name: "aidd-framework", pluginNames: [] });
  });

  it("skips a plugin entry that is not an object or names nothing", async () => {
    const fs = fsWithCatalog({
      name: "aidd-framework",
      plugins: [null, "text", { name: 3 }, { version: "1.0.0" }, { name: "a" }],
    });

    const identity = await catalogIdentityReader(fs).read(
      registeredTools().profile(TOOL.claude),
      DIR
    );

    expect(identity).toStrictEqual({ name: "aidd-framework", pluginNames: ["a"] });
  });

  it("answers nothing for a catalog whose name is not a string", async () => {
    const fs = fsWithCatalog({ name: 5, plugins: [{ name: "a" }] });

    expect(
      await catalogIdentityReader(fs).read(registeredTools().profile(TOOL.claude), DIR)
    ).toBeUndefined();
  });
});
