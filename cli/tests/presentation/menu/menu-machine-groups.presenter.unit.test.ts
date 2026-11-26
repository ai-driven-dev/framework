import { describe, expect, it } from "vitest";
import { isBranch } from "../../../src/orchestration/menu/menu-node.js";
import {
  maintainGroup,
  marketplacesGroup,
  systemGroup,
} from "../../../src/presentation/menu/menu-machine-groups.presenter.js";

describe("menu machine groups", () => {
  it("runs every marketplace entry through the marketplace command", () => {
    const commands = marketplacesGroup().children.flatMap((node) =>
      isBranch(node) ? [] : [node.command[0]]
    );

    expect(commands).toEqual(Array(5).fill("marketplace"));
  });

  it("offers the update, sync and clean commands to maintain a project", () => {
    const values = maintainGroup().children.map((node) => node.value);

    expect(values).toEqual(["framework-update-maintain", "sync-all", "clean"]);
  });

  it("nests the authentication commands under the system group", () => {
    const auth = systemGroup().children.find(isBranch);

    expect(auth?.children.map((node) => node.value)).toEqual([
      "auth-status",
      "auth-login",
      "auth-logout",
    ]);
  });
});
