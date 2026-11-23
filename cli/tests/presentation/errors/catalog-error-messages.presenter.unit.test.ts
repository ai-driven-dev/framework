import { describe, expect, it } from "vitest";
import {
  InvalidMarketplaceScopeError,
  MalformedMarketplaceCatalogError,
  MarketplaceAlreadyRegisteredError,
  MarketplaceNotFoundError,
  PluginFetchError,
  PluginNotInMarketplaceError,
  SharedMarketplaceRemovalError,
  UnreadableMarketplaceRegistryError,
} from "../../../src/contexts/distribution/contract/distribution.error.js";
import {
  CapabilityConfigError,
  DualConfigError,
  DuplicateToolIdError,
  InvalidAgentFrontmatterError,
  InvalidHooksDescriptorError,
  InvalidMcpServerConfigError,
  InvalidToolProfileError,
} from "../../../src/contexts/tools/contract/errors/tools.error.js";
import {
  FlatMergeTargetNotJsonError,
  FlatTargetExistsError,
  FrameworkPlaceholderInPluginError,
  InvalidBuildPathsError,
  JsonSchemaValidationError,
  MarketplaceOutDirNotEmptyError,
  OutDirNotDirectoryError,
} from "../../../src/contexts/translate/contract/translate.error.js";
import { render } from "../../../src/presentation/errors/error-translator.presenter.js";

/** Every error of marketplaces, builds and tool profiles, built with fixed arguments, and the exact words it shows. */
const cases: [() => Error, string][] = [
  [
    () => new InvalidMarketplaceScopeError("team"),
    'Invalid marketplace scope: "team". Expected "project" or "user".',
  ],
  [
    () => new MalformedMarketplaceCatalogError("/p/c.json", "bad", true),
    "Invalid plugin manifest: catalog at \"/p/c.json\" is malformed (bad). Run 'aidd marketplace refresh --force' to re-fetch a clean copy.",
  ],
  [
    () => new MalformedMarketplaceCatalogError("/p/c.json", "bad", false),
    'Invalid plugin manifest: catalog at "/p/c.json" is malformed (bad). Fix or re-create the marketplace catalog file.',
  ],
  [() => new MarketplaceAlreadyRegisteredError("m"), "Marketplace 'm' is already registered."],
  [() => new MarketplaceNotFoundError("m"), "Marketplace 'm' is not registered."],
  [() => new PluginFetchError("boom"), "Failed to fetch plugin: boom"],
  [
    () => new PluginFetchError('Authentication failed for "u".', "ssh-key"),
    'Failed to fetch plugin: Authentication failed for "u". Check your SSH key is registered on the remote host.',
  ],
  [
    () => new PluginFetchError('Authentication failed for "u".', "token"),
    'Failed to fetch plugin: Authentication failed for "u". Set AIDD_TOKEN, run `aidd auth login`, or pass --token <value>. Required scope depends on the host (github: `repo`, gitlab: `read_repository`, bitbucket: `repository:read`).',
  ],
  [
    () => new SharedMarketplaceRemovalError("aidd-framework", "project"),
    'Invalid marketplace name: ""aidd-framework" is shared by every project on this machine and is not removed with `aidd marketplace remove` — it is removed with the framework itself, by `aidd clean`, once machine scope lands there.". Use lowercase alphanumeric characters and hyphens only.',
  ],
  [
    () => new SharedMarketplaceRemovalError("aidd-framework", "user"),
    'Invalid marketplace name: ""aidd-framework" is shared by every project on this machine and is removed by `aidd clean --scope user`, not marketplace remove.". Use lowercase alphanumeric characters and hyphens only.',
  ],
  [
    () => new PluginNotInMarketplaceError("p"),
    "Plugin 'p' was not found in any registered marketplace.",
  ],
  [
    () => new UnreadableMarketplaceRegistryError("/p/r.json", "bad"),
    "Cannot read the marketplace registry at /p/r.json: bad. Repair the file, or delete it to start from an empty registry.",
  ],
  [
    () => new FlatMergeTargetNotJsonError("a.json", "bad"),
    "a.json is not valid JSON (bad); left untouched.",
  ],
  [
    () => new FlatTargetExistsError("/o/x", "p"),
    "Flat build conflict: '/o/x' already exists (plugin 'p'). Re-run with --force to overwrite.",
  ],
  [
    () => new FrameworkPlaceholderInPluginError("p", "a.md"),
    "Framework placeholder '@{{TOOLS}}/' is not allowed inside plugin 'p' (file: a.md).",
  ],
  [
    () => new InvalidBuildPathsError("src", "out"),
    "Refusing to build: --out 'out' and --source 'src' must not contain each other.",
  ],
  [() => new JsonSchemaValidationError(["a", "b"]), "Manifest validation failed: a; b"],
  [
    () => new MarketplaceOutDirNotEmptyError("/o"),
    "Refusing to build: '/o' is not empty. Re-run with --force to overwrite files this build produces, or choose an empty --out directory.",
  ],
  [
    () => new OutDirNotDirectoryError("/o"),
    "Refusing to build: --out '/o' does not exist or is not a directory.",
  ],
  [() => new CapabilityConfigError("cfg invalid"), "cfg invalid"],
  [() => new DuplicateToolIdError("cursor"), "Tool 'cursor' is registered twice."],
  [() => new InvalidAgentFrontmatterError("a", "bad"), "Agent 'a' has invalid frontmatter: bad."],
  [
    () => new InvalidHooksDescriptorError("claude", "unknown-event", "detail"),
    "The hooks descriptor of 'claude' breaks 'unknown-event': detail",
  ],
  [
    () => new InvalidMcpServerConfigError("srv"),
    'MCP server "srv" must have either a "command" or "url" field',
  ],
  [
    () => new InvalidToolProfileError("claude", "no-build-contract", "detail"),
    "The profile of 'claude' breaks 'no-build-contract': detail",
  ],
  [
    () => new DualConfigError("opencode", "opencode.json and opencode.jsonc exist"),
    "Both opencode.json and opencode.jsonc exist. Remove one.",
  ],
];

describe("the words of the errors of marketplaces, builds and tool profiles", () => {
  it.each(cases.map(([build, expected]) => ({ name: build().name, build, expected })))(
    "$name",
    ({ build, expected }) => {
      expect(render(build())).toBe(expected);
    }
  );
});
