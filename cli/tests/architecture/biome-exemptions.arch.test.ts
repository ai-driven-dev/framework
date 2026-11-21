/**
 * What `biome.json` spares from a rule: each exemption is held to the one carrier that writes it.
 */
import { describe, expect, it } from "vitest";
import { biomeConfig, type Override } from "./biome-config.js";

const PLUGIN = "biome-plugins/no-process-exit.grit";
const GITHUB_PLUGIN = "biome-plugins/one-github-api-url.grit";

/** An ambient module declaration needs `export default`: declaration files are the one kind
 * `noDefaultExport` spares. */
const DEFAULT_EXPORT_EXEMPT_DECLARATIONS = ["**/*.d.ts"];

type Carrier = (o: Override) => boolean | undefined;
const hasPlugin =
  (plugin: string): Carrier =>
  (o) =>
    o.plugins?.includes(plugin) ?? false;

/** The files and folders a Biome rule spares on purpose, by the rule's name: a new exemption is a
 * new entry here, written with its reason. */
const EXEMPTIONS: readonly { rule: string; carrier: Carrier; spared?: readonly string[] }[] = [
  { rule: "exemptProcessExit", carrier: hasPlugin(`./${PLUGIN}`) },
  { rule: "exemptGithubUrl", carrier: hasPlugin(`./${GITHUB_PLUGIN}`) },
  {
    rule: "exemptDefaultExport",
    carrier: (o) => "noDefaultExport" in (o.linter?.rules?.style ?? {}),
    spared: DEFAULT_EXPORT_EXEMPT_DECLARATIONS,
  },
  { rule: "exemptProfileImport", carrier: hasPlugin("./biome-plugins/whole-profile-import.grit") },
  { rule: "exemptProfileList", carrier: hasPlugin("./biome-plugins/no-profile-list.grit") },
];

const exemptionsOf = (
  carrier: (o: Override) => boolean | undefined,
  overrides: Override[] = biomeConfig().overrides ?? []
): string[] =>
  overrides
    .filter((o) => carrier(o))
    .flatMap((o) => (o.includes ?? []).filter((entry) => entry.startsWith("!")))
    .map((entry) => entry.slice(1));

describe("biome spares only what is written here", () => {
  for (const { rule, carrier, spared } of EXEMPTIONS) {
    it(`${rule} excludes exactly what it spares`, () => {
      expect(
        exemptionsOf(carrier),
        `${rule} spares what the negated includes of its override say: a new exemption is not added`
      ).toEqual([...(spared ?? [])]);
    });
  }

  it("reads a negated include as its exclusion, and no other include", () => {
    const overrides: Override[] = [{ includes: ["src/**", "!src/spared.ts", "tests/**"] }];
    expect(exemptionsOf(() => true, overrides)).toEqual(["src/spared.ts"]);
  });
});
