import { describe, expect, it } from "vitest";
import { serverPluginOf } from "../../../../../src/contexts/host-registration/domain/server/server-plugin.js";
import { exchangeOf } from "../../testing/server-recording.builder.js";

const data = (id: string): Record<string, unknown> => {
  const reply = JSON.parse(exchangeOf(id).response);
  return reply.data;
};

describe("reading a plugin a host's server holds", () => {
  it("names what the install answered, with the directory it came from", () => {
    expect(serverPluginOf(data("install"))).toEqual({
      id: "probe-plug",
      originalSource: "<scratch>/probes/kimi-plugins3/plug",
      healthy: true,
    });
  });

  it("reads each plugin of the list the same way", () => {
    const { plugins } = data("list");

    expect(Array.isArray(plugins) && plugins.map(serverPluginOf)).toEqual([
      expect.objectContaining({ id: "probe-plug", healthy: true }),
    ]);
  });

  it("calls a plugin unhealthy when its state is not ok or it reports errors", () => {
    const plugin = data("install");

    expect(serverPluginOf({ ...plugin, state: "error" })).toMatchObject({ healthy: false });
    expect(serverPluginOf({ ...plugin, hasErrors: true })).toMatchObject({ healthy: false });
  });
});
