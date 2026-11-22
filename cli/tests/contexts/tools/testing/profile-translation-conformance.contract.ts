import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import type { AiTool, IdeToolConfig } from "../../../../src/contexts/tools/domain/profile.js";
import { bundledSchemas } from "../../../shared/testing/bundled-schemas.builder.js";
import {
  aiCheck,
  type ConformanceCheck,
  type ConformanceSubject,
  contractsOf,
} from "./profile-conformance.contract.js";
import { referenceHooks, referencePlugin, reversed } from "./reference-plugin.builder.js";
import { translatePlugin } from "./translate-plugin.builder.js";

const PERSON_KEY = "personal";
const PERSON_SERVER = JSON.stringify({ mcpServers: { mine: { command: "node" } } });
const PLUGIN_SERVER = JSON.stringify({ mcpServers: { added: { command: "node" } } });

function filesOf(
  profile: AiTool,
  { translate = translatePlugin }: ConformanceSubject,
  name: string,
  arrival: "given" | "reversed" = "given"
) {
  const plugin = referencePlugin(name);
  return translate(arrival === "given" ? plugin : reversed(plugin), profile).files;
}

function withPersonKey(content: string): string {
  return JSON.stringify({ ...JSON.parse(content), [PERSON_KEY]: 1 });
}

const SCHEMA_VALIDATOR = new Ajv({ allErrors: true, strict: false, validateFormats: false });

const PRESENCE = {
  hasAgents: true,
  agentsList: ["reviewer.md"],
  skillsList: ["hello"],
  hasHooksJson: true,
  hasMcpJson: true,
};

export const PROFILE_TRANSLATION_CHECKS: readonly ConformanceCheck<ConformanceSubject>[] = [
  aiCheck("writes its files sorted by path, whatever order its files arrive in", (p, s) => {
    const given = filesOf(p, s, "alpha");
    const paths = given.map((file) => file.relativePath);
    expect(paths).toEqual([...paths].sort());
    expect(filesOf(p, s, "alpha", "reversed")).toEqual(given);
  }),
  aiCheck("writes no path that two distinct plugins share", (p, s) => {
    const alpha = filesOf(p, s, "alpha").map((file) => file.relativePath);
    const beta = filesOf(p, s, "beta").map((file) => file.relativePath);
    expect(alpha.filter((path) => beta.includes(path))).toEqual([]);
  }),
  aiCheck("builds only manifests that name the plugin and its version", (p) => {
    for (const { synthesizeManifest } of contractsOf(p)) {
      if (synthesizeManifest === null) continue;
      const manifest = synthesizeManifest({ name: "alpha", version: "1.0.0" }, PRESENCE);
      expect(JSON.parse(JSON.stringify(manifest))).toMatchObject({
        name: "alpha",
        version: "1.0.0",
      });
    }
  }),
  aiCheck("builds manifests that satisfy the schema it names", (p) => {
    for (const { synthesizeManifest, manifestSchemaName } of contractsOf(p)) {
      if (synthesizeManifest === null || manifestSchemaName === null) continue;
      const manifest = synthesizeManifest({ name: "alpha", version: "1.0.0" }, PRESENCE);
      const validate = SCHEMA_VALIDATOR.compile(bundledSchemas.loadSchema(manifestSchemaName));
      expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    }
  }),
  aiCheck("keeps a person's mcp servers and keys when a plugin's are merged in, and again", (p) => {
    const mcp = p.flatPluginMcp();
    if (mcp === null) return;
    const person = mcp.mergePluginServers(null, mcp.transform(PERSON_SERVER), new Map());
    const existing = withPersonKey(person.mergedContent);
    const first = mcp.mergePluginServers(existing, mcp.transform(PLUGIN_SERVER), new Map());
    const again = mcp.mergePluginServers(
      first.mergedContent,
      mcp.transform(PLUGIN_SERVER),
      first.contributedEntries
    );
    expect(first.mergedContent).toContain("mine");
    expect(first.mergedContent).toContain(PERSON_KEY);
    expect(again.mergedContent).toBe(first.mergedContent);
  }),
  aiCheck(
    "keeps a person's hooks and keys when a plugin's are merged in, and removed again",
    (p) => {
      const location = p.projectHooksDelivery();
      if (location === null) return;
      const { format } = location;
      const plugin = referenceHooks(`node ./${format.scriptPath("alpha", "hooks/check.cjs")}`);
      const person = withPersonKey(
        format.merge(null, referenceHooks("echo mine"), "person").content
      );
      const merged = format.merge(person, plugin, "alpha").content;
      const removed = format.unmerge(merged, "alpha");
      expect(JSON.parse(removed)).toEqual(JSON.parse(person));
      expect(format.merge(removed, plugin, "alpha").content).toBe(merged);
    }
  ),
];

export function describeProfileTranslationConformance(
  profile: AiTool | IdeToolConfig,
  registration: readonly (AiTool | IdeToolConfig)[]
): void {
  describe(`${profile.toolId} translation`, () => {
    for (const check of PROFILE_TRANSLATION_CHECKS) {
      it(check.title, () => check.holds({ profile, registration }));
    }
  });
}
