import { describe, expect, it } from "vitest";
import {
  reportInstallNotices,
  reportSkipWarnings,
} from "../../../../../../src/contexts/installation/application/plugin/add/report-placement.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

describe("reportSkipWarnings", () => {
  it("warns once per skipped component, naming plugin, component, tool and reason", () => {
    const logger = new CapturingLogger();

    reportSkipWarnings(logger, [
      { pluginName: "sample", component: "hooks", toolId: TOOL.claude, reason: "unsupported" },
    ]);

    expect(logger.warnMessages).toStrictEqual([
      `Plugin "sample": hooks skipped for ${TOOL.claude} — unsupported`,
    ]);
  });

  it("stays silent when nothing was skipped", () => {
    const logger = new CapturingLogger();

    reportSkipWarnings(logger, []);

    expect(logger.allMessages).toStrictEqual([]);
  });
});

describe("reportInstallNotices", () => {
  it("informs once per notice", () => {
    const logger = new CapturingLogger();

    reportInstallNotices(logger, [
      { pluginName: "sample", component: "hooks", toolId: TOOL.claude, message: "trust it" },
    ]);

    expect(logger.infoMessages).toStrictEqual([`Plugin "sample" (${TOOL.claude}): trust it`]);
  });
});
