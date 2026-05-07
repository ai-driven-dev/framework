import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FileHash, InstallationFile } from "../../../src/domain/models/file.js";
import { Manifest } from "../../../src/domain/models/manifest.js";
import { MarketplaceEntry } from "../../../src/domain/models/marketplace-entry.js";
import type { ToolId } from "../../../src/domain/models/tool-ids.js";
import { VALID_TOOL_IDS } from "../../../src/domain/models/tool-ids.js";

// ── Arbitraries ──────────────────────────────────────────────────────────────

/** 32-char lowercase hex → valid MD5. fast-check v4 removed hexaString; use stringMatching. */
const md5Arb = fc.stringMatching(/^[0-9a-f]{32}$/);

/** File path: no null bytes, no leading slash, non-empty. */
const relativePathArb = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter((s) => !s.includes("\0") && !s.startsWith("/") && s.trim().length > 0);

const installationFileArb = fc
  .record({ relativePath: relativePathArb, hash: md5Arb })
  .map(
    ({ relativePath, hash }) =>
      new InstallationFile({ relativePath, content: "x", hash: new FileHash(hash) })
  );

/** Valid tool id drawn from the real constant list. */
const toolIdArb = fc.constantFrom(...(VALID_TOOL_IDS as ToolId[]));

const toolEntryArb = fc.record({
  toolId: toolIdArb,
  version: fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !s.includes("\n") && s.trim().length > 0),
  files: fc.array(installationFileArb, { maxLength: 6 }),
});

/**
 * Marketplace name: /^[a-z0-9]+(-[a-z0-9]+)*$/
 * Build by joining 1-3 lowercase-alphanum segments with hyphens.
 */
const marketplaceNameArb = fc
  .array(
    fc.stringMatching(/^[a-z0-9]+$/).filter((s) => s.length >= 1 && s.length <= 12),
    { minLength: 1, maxLength: 3 }
  )
  .map((parts) => parts.join("-"));

/** Only local sources — round-trip is the invariant, not source coverage. */
const pluginSourceArb = fc.constantFrom(
  { kind: "local" as const, path: "/abs/path" },
  { kind: "local" as const, path: "/tmp/test" },
  { kind: "github" as const, repo: "owner/repo" }
);

const marketplaceEntryArb = fc
  .record({
    name: marketplaceNameArb,
    source: pluginSourceArb,
    scope: fc.constantFrom("project" as const, "user" as const),
  })
  .map(({ name, source, scope }) => MarketplaceEntry.create({ name, source, scope }));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a v5 Manifest from tools + marketplace entries.
 * Dedup tools by toolId (last-wins is fine; the Map already does that via addTool).
 * Dedup marketplaces by name to avoid MarketplaceAlreadyRegisteredError.
 */
function buildManifest(
  tools: Array<{ toolId: ToolId; version: string; files: InstallationFile[] }>,
  marketplaces: MarketplaceEntry[]
): Manifest {
  const m = Manifest.create();
  for (const t of tools) {
    m.addTool(t.toolId, t.version, t.files);
  }
  const seenNames = new Set<string>();
  for (const mp of marketplaces) {
    if (!seenNames.has(mp.name)) {
      seenNames.add(mp.name);
      m.addMarketplace(mp);
    }
  }
  return m;
}

// ── Property 1: round-trip identity ──────────────────────────────────────────

describe("Manifest property tests", () => {
  it("toJSON → fromJSON → toJSON is identity", () => {
    fc.assert(
      fc.property(
        fc.array(toolEntryArb, { maxLength: 4 }),
        fc.array(marketplaceEntryArb, { maxLength: 4 }),
        (tools, marketplaces) => {
          const m = buildManifest(tools, marketplaces);
          const firstSerialized = m.toJSON();
          const reparsed = Manifest.fromJSON(firstSerialized);
          const secondSerialized = reparsed.toJSON();
          expect(secondSerialized).toEqual(firstSerialized);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Property 2: migration chain idempotent on v5 input ──────────────────────

  it("migration chain on v5 input is idempotent (fromJSON round-trips cleanly)", () => {
    fc.assert(
      fc.property(
        fc.array(toolEntryArb, { maxLength: 4 }),
        fc.array(marketplaceEntryArb, { maxLength: 4 }),
        (tools, marketplaces) => {
          const m = buildManifest(tools, marketplaces);
          const v5 = m.toJSON();
          // Apply fromJSON twice — the migration branch must be a no-op on version 5.
          const once = Manifest.fromJSON(v5).toJSON();
          const twice = Manifest.fromJSON(once).toJSON();
          expect(twice).toEqual(once);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Property 3: v3/v4 raw shapes deserialize to v5 ──────────────────────────

  it("v3 raw shapes migrate to version 5 without throwing", () => {
    const v3ToolEntryArb = fc.record({
      toolId: toolIdArb,
      version: fc
        .string({ minLength: 1, maxLength: 20 })
        .filter((s) => !s.includes("\n") && s.trim().length > 0),
      files: fc.array(fc.record({ relativePath: relativePathArb, hash: md5Arb }), { maxLength: 4 }),
      mergeFiles: fc.constant([]),
    });

    fc.assert(
      fc.property(fc.array(v3ToolEntryArb, { maxLength: 4 }), (rawTools) => {
        const toolsRecord: Record<string, unknown> = {};
        const seenIds = new Set<string>();
        for (const t of rawTools) {
          if (!seenIds.has(t.toolId)) {
            seenIds.add(t.toolId);
            toolsRecord[t.toolId] = { ...t, plugins: [] };
          }
        }
        const rawV3 = {
          version: 3,
          mode: "local",
          docsDir: "aidd_docs",
          tools: toolsRecord,
        };
        const migrated = Manifest.fromJSON(rawV3);
        expect(migrated.toJSON().version).toBe(5);
      }),
      { numRuns: 100 }
    );
  });

  it("v4 raw shapes migrate to version 5 without throwing", () => {
    const v4ToolEntryArb = fc.record({
      toolId: toolIdArb,
      version: fc
        .string({ minLength: 1, maxLength: 20 })
        .filter((s) => !s.includes("\n") && s.trim().length > 0),
      files: fc.array(fc.record({ relativePath: relativePathArb, hash: md5Arb }), { maxLength: 4 }),
      mergeFiles: fc.constant([]),
    });

    fc.assert(
      fc.property(fc.array(v4ToolEntryArb, { maxLength: 4 }), (rawTools) => {
        const toolsRecord: Record<string, unknown> = {};
        const seenIds = new Set<string>();
        for (const t of rawTools) {
          if (!seenIds.has(t.toolId)) {
            seenIds.add(t.toolId);
            toolsRecord[t.toolId] = { ...t, plugins: [] };
          }
        }
        const rawV4 = {
          version: 4,
          mode: "local",
          docsDir: "aidd_docs",
          tools: toolsRecord,
        };
        const migrated = Manifest.fromJSON(rawV4);
        expect(migrated.toJSON().version).toBe(5);
      }),
      { numRuns: 100 }
    );
  });
});
