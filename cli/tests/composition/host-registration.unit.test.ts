import { describe, expect, it } from "vitest";
import { wireHostRegistration } from "../../src/composition/host-registration.js";
import {
  HostRegistryMarketplaceSourceReaderAdapter,
  NativeMarketplaceSourceReaderAdapter,
} from "../../src/contexts/tools/infrastructure/native-marketplace-source-reader-adapter.js";

describe("wireHostRegistration", () => {
  it("reads a marketplace's source from the registry or the host's list, as each tool declares", () => {
    const sources = wireHostRegistration("/home/tester").marketplaceSources;

    expect([...sources.keys()].sort()).toStrictEqual(["claude", "codex", "copilot"]);
    expect(sources.get("claude")).toBeInstanceOf(HostRegistryMarketplaceSourceReaderAdapter);
    expect(sources.get("codex")).toBeInstanceOf(NativeMarketplaceSourceReaderAdapter);
    expect(sources.get("copilot")).toBeInstanceOf(NativeMarketplaceSourceReaderAdapter);
  });

  it("keys every registry map by the tools that declare one", () => {
    const wired = wireHostRegistration("/home/tester");

    expect([...wired.pluginRegistries.keys()].sort()).toStrictEqual(["claude", "codex", "copilot"]);
    expect([...wired.marketplaceRegistries.keys()]).toStrictEqual(["claude"]);
    expect([...wired.hostActions.keys()].sort()).toStrictEqual(["claude", "codex", "copilot"]);
  });
});
