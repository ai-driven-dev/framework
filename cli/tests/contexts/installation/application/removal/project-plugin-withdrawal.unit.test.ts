import { describe, expect, it } from "vitest";
import { mayLetRefGo } from "../../../../../src/contexts/installation/application/removal/project-plugin-withdrawal.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const asked = (machineWide: boolean, confirmed: boolean | undefined) => ({
  toolId: TOOL.claude,
  tool: { pluginEnablementIsMachineGlobal: () => machineWide },
  confirmed,
  ref: "aidd-dev@framework",
});
const claims = (owned: boolean) => ({ isMachineOwned: async () => owned });

describe("a ref leaving the registration record", () => {
  it("goes once the host confirmed, whoever owns it", async () => {
    expect(await mayLetRefGo(asked(false, true), claims(false))).toBe(true);
  });

  it("stays when the host did not confirm for a tool that enables plugins per project", async () => {
    expect(await mayLetRefGo(asked(false, false), claims(true))).toBe(false);
  });

  it("goes unconfirmed for a tool that enables plugins machine-wide when a machine claim owns it", async () => {
    expect(await mayLetRefGo(asked(true, undefined), claims(true))).toBe(true);
  });

  it("stays unconfirmed for a tool that enables plugins machine-wide when no machine claim owns it", async () => {
    expect(await mayLetRefGo(asked(true, false), claims(false))).toBe(false);
  });
});
