import { describe, expect, it } from "vitest";
import {
  followsRequestedSource,
  untouchedReason,
} from "../../../../../src/contexts/host-registration/application/register/marketplace-registration-guard.js";
import type { NativeCatalogProof } from "../../../../../src/contexts/host-registration/application/register/native-catalog-proof.js";
import type { RegistrationRun } from "../../../../../src/contexts/host-registration/application/register/registration-run.js";
import type { HostMarketplaceRegistryReading } from "../../../../../src/contexts/host-registration/domain/reading/marketplace-registry-reading.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceRegistry } from "../../testing/fake-host-marketplace-registry.fake.js";

const DIR = "/built/aidd";
const REGISTRY: NativeMarketplaceSource = { kind: "registry", source: DIR };
const CLEAN: NativeCatalogProof = {
  canonical: true,
  hostReadable: true,
  sourceStatus: "owned",
  source: REGISTRY,
};

function runWith(registry: HostMarketplaceRegistryReading): RegistrationRun {
  const profile = registeredTools().aiProfileIfAny(TOOL.claude);
  if (profile === null) throw new Error("claude is an AI tool");
  return {
    toolId: TOOL.claude,
    profile,
    activator: new FakeHostActions({ available: true }),
    fs: new InMemoryFileAdapter({}),
    hosts: {
      marketplaceRegistries: new Map([[TOOL.claude, new FakeHostMarketplaceRegistry(registry)]]),
      pluginRegistries: new Map(),
      sources: new Map(),
    },
    projectRoot: "/p",
    claims: {
      recorded: undefined,
      machine: async () => undefined,
      machineKept: false,
      persistedProject: async () => undefined,
    },
    userCacheRoot: () => "",
    platform: "linux",
    logger: new CapturingLogger(),
    warnings: [],
  };
}

const request = {
  builtDir: DIR,
  identity: { name: "aidd", pluginNames: [] },
  marketplace: { name: "aidd", scope: "project" as const },
};
const EMPTY = { location: "r", entries: new Map<string, string>() };
const HELD = { location: "r", entries: new Map([["aidd", DIR]]) };

describe("untouchedReason", () => {
  it("lets the registration go on when the proof is clean and the host reads fine", async () => {
    expect(await untouchedReason(runWith(EMPTY), request, CLEAN)).toBeUndefined();
  });

  it("names the proof's reason when the host source is unproven", async () => {
    const proof = { ...CLEAN, sourceStatus: "unproven" as const, sourceReason: "no list" };
    expect(await untouchedReason(runWith(EMPTY), request, proof)).toMatch(
      /host source unproven \(no list\)/
    );
  });

  it("treats an owned status without a source as unproven", async () => {
    const proof = { ...CLEAN, source: undefined };
    expect(await untouchedReason(runWith(EMPTY), request, proof)).toMatch(
      /host source unproven \(unknown\)/
    );
  });

  it("leaves a same-name registration alone when no canonical claim backs it", async () => {
    const proof = { ...CLEAN, canonical: false };
    expect(await untouchedReason(runWith(HELD), request, proof)).toMatch(
      /without a canonical AIDD claim/
    );
  });

  it("does not call an absent name a collision when the claim is not canonical", async () => {
    const proof = { ...CLEAN, canonical: false };
    expect(await untouchedReason(runWith(EMPTY), request, proof)).toBeUndefined();
  });

  it("leaves the registration alone when the host registry cannot be read", async () => {
    const unreadable = { location: "r", unreadable: "EACCES" };
    expect(await untouchedReason(runWith(unreadable), request, CLEAN)).toMatch(
      /host registry is unreadable/
    );
  });

  it("accepts a registry that does not exist yet", async () => {
    const absent = { location: "r", absent: true as const };
    expect(await untouchedReason(runWith(absent), request, CLEAN)).toBeUndefined();
  });

  it("names the foreign ref the proof found", async () => {
    const proof = { ...CLEAN, foreignRef: "x@aidd" };
    expect(await untouchedReason(runWith(EMPTY), request, proof)).toMatch(
      /foreign host ref 'x@aidd'/
    );
  });

  it("names the unreadable plugin registry the proof carries", async () => {
    const proof = { ...CLEAN, unreadable: "EACCES" };
    expect(await untouchedReason(runWith(EMPTY), request, proof)).toMatch(
      /unreadable host plugin registry \(EACCES\)/
    );
  });

  it("leaves the registration alone when the host plugin registry was not read at all", async () => {
    const proof = { ...CLEAN, hostReadable: false };
    expect(await untouchedReason(runWith(EMPTY), request, proof)).toMatch(
      /collides with unreadable host plugin registry/
    );
  });
});

describe("followsRequestedSource", () => {
  it("follows a registry entry at the requested path", () => {
    expect(followsRequestedSource(CLEAN, DIR, "linux")).toBe(true);
  });

  it("does not follow a registry entry at another path", () => {
    expect(followsRequestedSource(CLEAN, "/other", "linux")).toBe(false);
  });

  it("does not follow a source the host does not prove as ours", () => {
    expect(followsRequestedSource({ ...CLEAN, sourceStatus: "absent" }, DIR, "linux")).toBe(false);
    expect(followsRequestedSource({ ...CLEAN, source: undefined }, DIR, "linux")).toBe(false);
  });

  it("follows an effective-list entry only when its root is the path and its type local", () => {
    const listed = (root: string, sourceType: string): NativeCatalogProof => ({
      ...CLEAN,
      source: { kind: "effective-list", source: DIR, root, sourceType },
    });
    expect(followsRequestedSource(listed(DIR, "local"), DIR, "linux")).toBe(true);
    expect(followsRequestedSource(listed("/elsewhere", "local"), DIR, "linux")).toBe(false);
    expect(followsRequestedSource(listed(DIR, "git"), DIR, "linux")).toBe(false);
  });
});
