import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const { VitestTestRunner } = await import(pathToFileURL(process.argv[2]).href);
const trace = join(process.cwd(), "executed.txt");
process.env.FILTER_TRACE = trace;
writeFileSync(trace, "");
const runner = new VitestTestRunner(
  { vitest: { configFile: join(process.cwd(), "vitest.config.mjs"), related: false }, disableBail: true },
  { isDebugEnabled: () => false, warn: () => {} },
  "__stryker__"
);

try {
  await runner.init();
  const dryRun = await runner.dryRun({ files: [], coverageAnalysis: "off", timeout: 10000 });
  if (dryRun.status !== "complete") throw new Error(JSON.stringify(dryRun));
  const selected = (file, name) => {
    const test = dryRun.tests.find((test) => basename(test.fileName) === file && test.name === name);
    if (test === undefined) throw new Error(`Missing ${file}#${name}`);
    return test.id;
  };
  const runSelection = async (testFilter) => {
    writeFileSync(trace, "");
    const result = await runner.mutantRun({
      activeMutant: { id: "0" },
      mutantActivation: "dynamic",
      sandboxFileName: join(process.cwd(), "register-tests.mjs"),
      testFilter,
      hitLimit: 100,
      timeout: 10000,
    });
    return {
      status: result.status,
      nrOfTests: result.nrOfTests,
      executed: readFileSync(trace, "utf8").trim().split("\n").sort(),
    };
  };
  const left = selected("a.test.mjs", "left");
  const crossFile = await runSelection([left, selected("b.test.mjs", "right")]);
  const exactFile = await runSelection([left]);
  writeFileSync(
    join(process.cwd(), "result.json"),
    JSON.stringify({ dryRunCount: dryRun.tests.length, crossFile, exactFile })
  );
} finally {
  await runner.dispose();
}
