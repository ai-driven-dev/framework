import { describe, expect, it } from "vitest";
import { wireHostRegistration } from "../../src/composition/host-registration.js";
import {
  HostRegistryMarketplaceSourceReaderAdapter,
  NativeMarketplaceSourceReaderAdapter,
} from "../../src/contexts/host-registration/infrastructure/marketplace-source-readers.js";

describe("wireHostRegistration", () => {
  it("reads a marketplace's source from the registry or the host's list, as each tool declares", () => {
    const sources = wireHostRegistration("/home/tester").marketplaceSources;

    expect([...sources.keys()].sort()).toStrictEqual(["claude", "codex", "copilot"]);
    expect(sources.get("claude")).toBeInstanceOf(HostRegistryMarketplaceSourceReaderAdapter);
    expect(sources.get("codex")).toBeInstanceOf(NativeMarketplaceSourceReaderAdapter);
    expect(sources.get("copilot")).toBeInstanceOf(NativeMarketplaceSourceReaderAdapter);
  });
});
