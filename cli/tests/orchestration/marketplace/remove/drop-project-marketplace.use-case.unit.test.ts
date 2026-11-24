import { describe, expect, it } from "vitest";
import { DropProjectMarketplace } from "../../../../src/orchestration/marketplace/remove/drop-project-marketplace.use-case.js";

describe("dropping a project marketplace", () => {
  it("forgets its registry entry, then the trees it was built into", async () => {
    const steps: string[] = [];
    const drop = new DropProjectMarketplace(
      { execute: async ({ marketplace }) => void steps.push(`registry ${marketplace.name}`) },
      { execute: async ({ name }) => void steps.push(`built ${name}`) }
    );

    await drop.execute({ projectRoot: "/p", marketplace: { name: "awesome", scope: "project" } });

    expect(steps).toStrictEqual(["registry awesome", "built awesome"]);
  });
});
