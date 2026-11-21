import type * as auth from "../../contexts/auth/domain/auth.error.js";
import type * as distribution from "../../contexts/distribution/domain/distribution.error.js";
import { MAX_IDENTITY_LENGTH } from "../../contexts/telemetry/contract/identity-limit.js";
import type * as telemetry from "../../contexts/telemetry/domain/telemetry.error.js";
import type * as update from "../../contexts/update/domain/update.error.js";
import type { AiddError } from "../../shared/domain/shared.error.js";

type Classes<Module> = Module[keyof Module];
/** Every error class of the owners already moved here. */
type Catalogued = InstanceType<
  | Classes<typeof auth>
  | Classes<typeof update>
  | Classes<typeof telemetry>
  | Classes<typeof distribution>
>;
type ByCode = { [Error in Catalogued as Error["code"]]: Error };

/** One entry says what its own error class carries; a method signature lets the table widen to any code. */
interface Words {
  say(error: AiddError): string;
}

const entries: { [Code in keyof ByCode]: (error: ByCode[Code]) => string } = {
  "auth-storage": (error) => error.detail,
  "gh-cli": (error) => error.detail,
  "elevated-permission-update": (error) =>
    "Update failed: the global package directory is not writable (EPERM/EACCES).\n" +
    "Pick one:\n" +
    "  1. Run the terminal as Administrator (Windows) or with sudo (macOS/Linux), then re-run `aidd update`.\n" +
    "  2. Move global installs to a user-writable prefix, then re-run the update:\n" +
    "     Windows:  npm config set prefix %APPDATA%\\npm\n" +
    "     macOS/Linux:  npm config set prefix ~/.npm-global\n" +
    `  3. Run the update directly: ${error.installCommand}`,
  "framework-resolution": (error) => error.detail,
  "package-manager-detection": (error) =>
    `Could not detect package manager. Run manually:\n  ${error.commands.join("\n  ")}`,
  "conflicting-identity-flags": () =>
    "--as names you and --anonymous names nobody: give one of them.",
  "identity-off-with-identifier": () => "--off removes the identity: give it no identifier.",
  "invalid-identity": () =>
    `An identity is one non-empty line of at most ${MAX_IDENTITY_LENGTH} characters. Nothing was changed.`,
  "invalid-report-period": (error) => error.detail,
  "task-declared-none-with-name": () =>
    "--none declares no task: give it neither a name nor --ticket.",
  "task-name-missing": () =>
    "A task needs a name: aidd telemetry task <name> [--ticket <ref>], or --none. See what the work is bound to with aidd telemetry status.",
  "invalid-marketplace-scope": (error) =>
    `Invalid marketplace scope: "${error.scope}". Expected "project" or "user".`,
  "malformed-marketplace-catalog": (error) =>
    `Invalid plugin manifest: catalog at "${error.path}" is malformed (${error.detail}). ${
      error.cached
        ? "Run 'aidd marketplace refresh --force' to re-fetch a clean copy."
        : "Fix or re-create the marketplace catalog file."
    }`,
  "marketplace-already-registered": (error) =>
    `Marketplace '${error.marketplace}' is already registered.`,
  "marketplace-not-found": (error) => `Marketplace '${error.marketplace}' is not registered.`,
  "plugin-fetch": (error) => `Failed to fetch plugin: ${error.detail}`,
  "plugin-not-in-marketplace": (error) =>
    `Plugin '${error.plugin}' was not found in any registered marketplace.`,
  "unreadable-marketplace-registry": (error) =>
    `Cannot read the marketplace registry at ${error.path}: ${error.reason}. Repair the file, or ` +
    `delete it to start from an empty registry.`,
  update: () =>
    "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\n" +
    "Update your token at https://github.com/settings/tokens, then re-run `aidd auth login`.",
};

/** What each catalogued error says, by its code. */
export const MESSAGES: Readonly<Record<string, Words["say"] | undefined>> = entries;
