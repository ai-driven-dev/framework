import { CommandsCapability } from "../../../../src/contexts/tools/domain/capabilities/commands-capability.js";
import { McpCapability } from "../../../../src/contexts/tools/domain/capabilities/mcp-capability.js";
import { PluginsCapability } from "../../../../src/contexts/tools/domain/capabilities/plugins-capability.js";
import type { ConformanceSubject } from "./profile-conformance.js";
import {
  anEmptyContract,
  aProfile,
  flatPlugins,
  nativePlugins,
  type ProfileBuilder,
} from "./profiles.js";

function alone(profile: ProfileBuilder): ConformanceSubject {
  const built = profile.build();
  return { profile: built, registration: [built] };
}

/** A profile every check holds for: the one each broken subject below spoils in one place. */
export function aValidProfile(): ConformanceSubject {
  return alone(aProfile());
}

const SOURCE = { kind: "fullTree", srcDir: "x" } as const;

function withArtifacts(overrides: Partial<ReturnType<typeof anEmptyContract>["artifacts"]>) {
  return anEmptyContract({ artifacts: { ...anEmptyContract().artifacts, ...overrides } });
}

function numberedCommands(install: string | null): CommandsCapability {
  return new CommandsCapability({
    directory: ".fake/",
    toolSuffix: ".md",
    buildInstallPath: () => install,
    convertFrontmatter: (fm) => fm,
  });
}

const SETTINGS = {
  settingsPath: ".fake/settings.json",
  settingsKey: "marketplaces",
  marketplacesSettingsPath: null,
  toEntryKey: () => null,
};

/** One subject per check, in the checks' order, each spoiling exactly the check it is titled for. */
export const BROKEN_PROFILES: readonly { title: string; subject: () => ConformanceSubject }[] = [
  {
    title: "is registered once, under its own id",
    subject: () => {
      const profile = aProfile().build();
      return { profile, registration: [profile, profile] };
    },
  },
  { title: "has a well-formed shape", subject: () => alone(aProfile().withToolSuffix("md")) },
  {
    title: "keeps a relative directory ending in a slash",
    subject: () => alone(aProfile().withDirectory("/abs/")),
  },
  {
    title:
      "computes every path relative, and keeps commands, rules, agents and flat hooks under its directory",
    subject: () => alone(aProfile().withCommands(numberedCommands("../escape.md"))),
  },
  {
    title: "builds neither rules nor commands from the plugin tree",
    subject: () =>
      alone(
        aProfile().withBuildContract(
          "flat",
          withArtifacts({ rules: { supported: true, source: SOURCE, path: (_p, rel) => rel } })
        )
      ),
  },
  {
    title: "gives every supported artifact a non-empty path",
    subject: () =>
      alone(
        aProfile().withBuildContract(
          "flat",
          withArtifacts({ skills: { supported: true, source: SOURCE, path: () => "" } })
        )
      ),
  },
  {
    title: "is reachable by at least one build",
    subject: () => alone(aProfile().withoutBuildContracts()),
  },
  {
    title: "is probed where it publishes a marketplace",
    subject: () => alone(aProfile().withBuildContract("marketplace", anEmptyContract())),
  },
  {
    title: "drives native activation where it declares marketplace settings",
    subject: () => alone(aProfile().withPlugins(nativePlugins({ marketplaceSettings: SETTINGS }))),
  },
  {
    title: "lets its flat build carry hooks exactly when it accepts them",
    subject: () => alone(aProfile().withPlugins(flatPlugins("accepts"))),
  },
  {
    title: "declares a plugin root token exactly in native mode",
    subject: () =>
      alone(
        aProfile().withPlugins(
          new PluginsCapability({
            mode: "native",
            acceptsHooks: true,
            pluginsDir: ".fake/plugins/",
            pluginManifestRelativePath: null,
          })
        )
      ),
  },
  {
    title: "names a variable, never a path",
    subject: () =>
      alone(aProfile().withPlugins(nativePlugins({ pluginRootToken: "$PLUGIN_ROOT" }))),
  },
  {
    title: "writes its own token into a marketplace build",
    subject: () =>
      alone(
        aProfile()
          .withPlugins(nativePlugins())
          .withMarketplaceProbe([".fake/marketplace.json"])
          // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a host expands
          .withBuildContract("marketplace", anEmptyContract({ pluginRootToken: "${OTHER}" }))
      ),
  },
  {
    title: "writes no token into a flat build",
    subject: () =>
      alone(
        aProfile().withBuildContract(
          "flat",
          // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a host expands
          anEmptyContract({ pluginRootToken: "${FAKE_PLUGIN_ROOT}" })
        )
      ),
  },
  {
    title: "declares a plugins capability",
    subject: () => alone(aProfile().withPlugins(undefined)),
  },
  {
    title: "feeds its mcp file from the mcp config",
    subject: () =>
      alone(aProfile().withMcp(new McpCapability({ outputPath: ".mcp.json", format: "json" }))),
  },
  {
    title: "routes a numbered command and its references to the same folder",
    subject: () =>
      alone(aProfile().withCommands(numberedCommands(".fake/commands/aidd/04/implement.md"))),
  },
];
