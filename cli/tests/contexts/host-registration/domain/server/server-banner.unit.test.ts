import { describe, expect, it } from "vitest";
import { serverEndpointIn } from "../../../../../src/contexts/host-registration/domain/server/server-banner.js";
import { SERVER_RECORDING } from "../../testing/server-recording.builder.js";

const PATTERN = "Local:\\s+(\\S+?)/?#token=(\\S+)";

describe("reading where a host's plugin server listens", () => {
  it("takes the address and the token off the banner the host printed", () => {
    expect(serverEndpointIn(SERVER_RECORDING.banner, PATTERN)).toEqual({
      baseUrl: "http://127.0.0.1:<port>",
      token: "<token>",
    });
  });

  it("answers nothing while the banner has not been printed in full", () => {
    expect(serverEndpointIn("Kimi server ready\n  Local:    http://127.0.0.1:5", PATTERN)).toBe(
      undefined
    );
  });
});
