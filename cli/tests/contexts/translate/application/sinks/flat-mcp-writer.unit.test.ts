import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { writeFlatMcp } from "../../../../../src/contexts/translate/application/sinks/flat-mcp-writer.js";
import { FlatTargetExistsError } from "../../../../../src/contexts/translate/contract/translate.error.js";
import type { FlatMcpStep } from "../../../../../src/contexts/translate/ports/flat-plugin-writer.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const OUT = resolve("/tmp/flat-mcp-writer");
const SERVERS = { "plug-db": { command: "run" } };

function stepOf(over: Partial<FlatMcpStep["target"]> = {}): FlatMcpStep {
  const mcp = aSupportedArtifact({
    placement: { kind: "file", at: ".tool/mcp.json" },
    mcpServersKey: "servers",
  });
  if (!mcp.supported) throw new Error("stub mcp is supported");
  return {
    target: { contract: aStubBuildContract(), force: false, outDir: OUT, ...over },
    mcp: { ...mcp, mcpServersKey: "servers" },
    pluginName: "plug",
    servers: SERVERS,
  };
}

describe("writing mcp servers into a flat config", () => {
  it("merges the servers under the declared key into the file the artifact's path names", async () => {
    const fs = new InMemoryFileAdapter({});

    await expect(writeFlatMcp(fs, stepOf())).resolves.toBe(1);
    expect(JSON.parse(fs.getFile(`${OUT}/.tool/mcp.json`) ?? "{}")).toEqual({ servers: SERVERS });
  });

  it("keeps what the file already held", async () => {
    const fs = new InMemoryFileAdapter({
      [`${OUT}/.tool/mcp.json`]: JSON.stringify({ servers: { mine: {} }, other: 1 }),
    });

    await writeFlatMcp(fs, stepOf());

    expect(JSON.parse(fs.getFile(`${OUT}/.tool/mcp.json`) ?? "{}")).toEqual({
      servers: { mine: {}, ...SERVERS },
      other: 1,
    });
  });

  it("refuses a server already there unless forced", async () => {
    const fs = new InMemoryFileAdapter({
      [`${OUT}/.tool/mcp.json`]: JSON.stringify({ servers: { "plug-db": { command: "old" } } }),
    });

    await expect(writeFlatMcp(fs, stepOf())).rejects.toBeInstanceOf(FlatTargetExistsError);
    await expect(writeFlatMcp(fs, stepOf({ force: true }))).resolves.toBe(1);
  });
});
