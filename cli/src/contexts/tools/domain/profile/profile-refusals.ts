import { isAbsolute } from "node:path";
import type { ShippedConfig } from "../../contract/tool-profile.js";
import type { ProfileSections } from "../profile.js";
import { isProfileSectionKey } from "../profile.js";
import { InvalidToolProfileError } from "../tools.error.js";
import { deliverySuits } from "./plugin-answers.js";
import { settingsOf } from "./profile-answers.js";

export function refuseDirectory(toolId: string, directory: string): void {
  if (isAbsolute(directory)) {
    throw new InvalidToolProfileError(
      toolId,
      "directory-not-relative",
      `'${directory}' must be relative to the project root.`
    );
  }
  if (!directory.endsWith("/")) {
    throw new InvalidToolProfileError(
      toolId,
      "directory-without-trailing-slash",
      `'${directory}' must end with '/'.`
    );
  }
}

export function refuseUnknownSections(toolId: string, sections: ProfileSections): void {
  for (const key of Object.keys(sections)) {
    if (!isProfileSectionKey(key)) {
      throw new InvalidToolProfileError(toolId, "unknown-section", `'${key}' is no section.`);
    }
  }
}

function refuse(toolId: string, detail: string): never {
  throw new InvalidToolProfileError(toolId, "plugin-sections-disagree", detail);
}

/** A layout, its manifest and its hooks delivery are one declaration: they agree or no profile. */
export function refuseDisagreeingPlugin(toolId: string, sections: ProfileSections): void {
  const { layout, manifest, hooks } = sections;
  if (layout === undefined) {
    if (manifest !== undefined) refuse(toolId, "a manifest needs a native layout.");
    return;
  }
  refuseManifestMismatch(toolId, layout.mode, manifest !== undefined);
  if (hooks === undefined)
    refuse(toolId, "a layout requires a hooks section to state its delivery.");
  if (!deliverySuits(layout, hooks.delivery)) {
    refuse(
      toolId,
      `hooks delivery '${hooks.delivery.kind}' does not suit a ${layout.mode} layout.`
    );
  }
}

function refuseManifestMismatch(toolId: string, mode: string, hasManifest: boolean): void {
  if (mode === "native" && !hasManifest) {
    refuse(toolId, "a native layout requires a manifest section.");
  }
  if (mode !== "native" && hasManifest)
    refuse(toolId, `a ${mode} layout takes no manifest section.`);
}

/** A shipped file is one name and one place, and a section's file is where that section writes it:
 * a name declared twice, or a section file elsewhere than its section, answers two ways. */
export function refuseDisagreeingShippedConfig(
  toolId: string,
  assets: readonly ShippedConfig[] | undefined,
  sections: ProfileSections
): void {
  const settings = settingsOf(sections);
  const seen = new Set<string>();
  for (const asset of assets ?? []) {
    if (seen.has(asset.name)) {
      refuseShipped(toolId, `'${asset.name}' is shipped twice.`);
    }
    seen.add(asset.name);
    if (
      asset.delivery === "section" &&
      !settings.some((section) => section.writes(asset.destination))
    ) {
      refuseShipped(
        toolId,
        `'${asset.name}' lands at ${asset.destination}, which no settings section writes.`
      );
    }
  }
}

function refuseShipped(toolId: string, detail: string): never {
  throw new InvalidToolProfileError(toolId, "shipped-config-disagrees", detail);
}

export function refuseWithoutBuildContract(
  toolId: string,
  contracts: { readonly marketplace?: unknown; readonly flat?: unknown }
): void {
  if (contracts.marketplace === undefined && contracts.flat === undefined) {
    throw new InvalidToolProfileError(
      toolId,
      "no-build-contract",
      "an AI tool declares a marketplace or a flat build contract."
    );
  }
}
