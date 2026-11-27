import { describe, expect, it } from "vitest";
import { enableRefs } from "../../../../../src/contexts/host-registration/application/register/enable-refs.js";
import { enabled, setup } from "../../testing/registration-run.builder.js";

const proven = [{ alias: "aidd", hostName: "aidd" }];
const ask = (...refs: string[]) => ({ scope: "project" as const, refsToEnable: () => refs });

describe("enabling plugin refs on a host", () => {
  it("enables a ref the host does not yet enable", async () => {
    const { run, activator } = setup();
    expect(await enableRefs(run, ask("a@aidd"), proven)).toEqual(["a@aidd"]);
    expect(activator.enabledPlugins).toEqual(["a@aidd"]);
  });

  it("hands the request each proven marketplace's host name by alias", async () => {
    const { run } = setup();
    const seen: ReadonlyMap<string, string>[] = [];
    const refsToEnable = (names: ReadonlyMap<string, string>) => {
      seen.push(names);
      return [];
    };
    await enableRefs(run, { scope: "project", refsToEnable }, [
      { alias: "mine", hostName: "theirs" },
    ]);
    expect(seen.map((names) => [...names])).toEqual([[["mine", "theirs"]]]);
  });

  it("leaves a ref enabled before this project asked, and says so", async () => {
    const { run, activator, logger } = setup({ plugins: enabled("x@aidd") });
    expect(await enableRefs(run, ask("x@aidd"), proven)).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(logger.infoMessages).toHaveLength(1);
  });

  it("counts a ref the machine already claims as owned without enabling it again", async () => {
    const { run, activator } = setup({
      plugins: enabled("x@aidd"),
      claims: { machine: async () => ({ marketplaces: [], claimedRefs: ["x@aidd"] }) },
    });
    expect(await enableRefs(run, ask("x@aidd"), proven)).toEqual(["x@aidd"]);
    expect(activator.enabledPlugins).toEqual([]);
  });
});
