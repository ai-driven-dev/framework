import { describe, expect, it } from "vitest";
import { BuildMenu } from "../../../src/orchestration/menu/build-menu.use-case.js";
import { installedNodes } from "../../../src/presentation/menu/menu-tree.presenter.js";
import { syntheticCatalog } from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  makeQueuedPrompter,
  type SelectCall,
  setUp,
} from "../testing/queued-menu-prompter.builder.js";

const BACK_AND_EXIT = [
  { name: "← Back", value: "back" },
  { name: "Exit", value: "exit" },
];

async function choicesAt(path: string[]): Promise<SelectCall> {
  const { prompter, selectCalls } = makeQueuedPrompter([...path, "exit"]);

  await new BuildMenu(setUp(true), prompter, installedNodes(syntheticCatalog())).execute();

  const call = selectCalls[path.length];
  return [call[0], call[1]];
}

describe("interactive menu - the rows each level offers", () => {
  it("offers six groups and an exit at the root, each named and described", async () => {
    expect(await choicesAt([])).toEqual([
      "What would you like to do?",
      [
        {
          name: "Inspect",
          value: "inspect",
          description: "Check status, health and installed items",
        },
        {
          name: "Manage tools",
          value: "manage-tools",
          description: "Install, remove and update AI or IDE tools",
        },
        {
          name: "Manage plugins",
          value: "manage-plugins",
          description: "Browse, install and manage AI tool plugins",
        },
        {
          name: "Marketplaces",
          value: "marketplaces",
          description: "Manage plugin marketplace registrations",
        },
        {
          name: "Maintain & repair",
          value: "maintain",
          description: "Update tools, sync tracked files, and clean everything",
        },
        { name: "System", value: "system", description: "CLI update and authentication" },
        { name: "Exit", value: "exit" },
      ],
    ]);
  });

  it("offers no way back from the root, only out", async () => {
    const [, choices] = await choicesAt([]);

    expect(choices.map((choice) => choice.value)).not.toContain("back");
  });

  it("offers the three inspect commands under the group's own name", async () => {
    expect(await choicesAt(["inspect"])).toEqual([
      "Inspect",
      [
        {
          name: "Doctor",
          value: "doctor",
          description: "Tool inventory, drift, plugins, and structural health",
        },
        {
          name: "Doctor (one tool)",
          value: "doctor-tool",
          description: "Scope the report to a single AI or IDE tool",
        },
        {
          name: "Plugins",
          value: "plugin-list",
          description: "Show installed plugins per tool",
        },
        ...BACK_AND_EXIT,
      ],
    ]);
  });

  it("offers the four tool commands under Manage tools", async () => {
    expect(await choicesAt(["manage-tools"])).toEqual([
      "Manage tools",
      [
        { name: "Install", value: "framework-install", description: "Add a tool to this project" },
        { name: "Remove", value: "framework-remove", description: "Remove an installed tool" },
        {
          name: "Update all",
          value: "framework-update-all",
          description: "Re-install every installed tool's configs from bundled assets",
        },
        {
          name: "Update one",
          value: "framework-update-one",
          description: "Re-install one tool's configs from bundled assets",
        },
        ...BACK_AND_EXIT,
      ],
    ]);
  });

  it("offers the six plugin commands under Manage plugins", async () => {
    expect(await choicesAt(["manage-plugins"])).toEqual([
      "Manage plugins",
      [
        {
          name: "Install plugin",
          value: "plugin-install",
          description: "Install a plugin by name, local path, or interactive pick",
        },
        {
          name: "Search",
          value: "plugin-search",
          description: "Search plugins across all registered marketplaces",
        },
        {
          name: "Update",
          value: "plugin-update",
          description: "Update all installed plugins to latest version",
        },
        { name: "Remove", value: "plugin-remove", description: "Remove an installed plugin" },
        {
          name: "List",
          value: "plugin-list-2",
          description: "Show all installed plugins per tool",
        },
        {
          name: "Doctor",
          value: "plugin-doctor",
          description: "Check one plugin's installation health",
        },
        ...BACK_AND_EXIT,
      ],
    ]);
  });

  it("offers the five marketplace commands under Marketplaces", async () => {
    expect(await choicesAt(["marketplaces"])).toEqual([
      "Marketplaces",
      [
        {
          name: "List",
          value: "marketplace-list",
          description: "Show all registered marketplaces",
        },
        {
          name: "Add",
          value: "marketplace-add",
          description: "Register a new plugin marketplace",
        },
        {
          name: "Refresh",
          value: "marketplace-refresh",
          description: "Refresh all registered marketplaces",
        },
        { name: "Remove", value: "marketplace-remove", description: "Unregister a marketplace" },
        {
          name: "Check freshness",
          value: "marketplace-check",
          description: "Report stale marketplaces",
        },
        ...BACK_AND_EXIT,
      ],
    ]);
  });

  it("offers the three repair commands under Maintain & repair", async () => {
    expect(await choicesAt(["maintain"])).toEqual([
      "Maintain & repair",
      [
        {
          name: "Update all tools",
          value: "framework-update-maintain",
          description: "Re-install every installed tool's configs from bundled assets",
        },
        {
          name: "Sync everything",
          value: "sync-all",
          description:
            "Regenerate tracked files across all installed tools, driven by the manifest",
        },
        {
          name: "Clean (nuke .aidd)",
          value: "clean",
          description: "Remove all AIDD-managed files from this project",
        },
        ...BACK_AND_EXIT,
      ],
    ]);
  });

  it("offers the CLI's own update and a nested authentication branch under System", async () => {
    expect(await choicesAt(["system"])).toEqual([
      "System",
      [
        {
          name: "Update CLI",
          value: "self-update",
          description: "Update the AIDD CLI binary itself (bare `update`)",
        },
        {
          name: "Authentication",
          value: "auth",
          description: "Manage authentication credentials",
        },
        ...BACK_AND_EXIT,
      ],
    ]);
  });

  it("offers the three authentication commands two levels down", async () => {
    expect(await choicesAt(["system", "auth"])).toEqual([
      "Authentication",
      [
        {
          name: "Status",
          value: "auth-status",
          description: "Show current authentication status",
        },
        { name: "Login", value: "auth-login", description: "Authenticate with your credentials" },
        { name: "Logout", value: "auth-logout", description: "Remove stored credentials" },
        ...BACK_AND_EXIT,
      ],
    ]);
  });
});
