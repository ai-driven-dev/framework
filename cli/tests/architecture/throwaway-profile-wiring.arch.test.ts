import { describe, expect, it } from "vitest";
import config from "../../vitest.config.js";
import mutation from "../../vitest.mutation.config.js";

const SETUP = "./tests/helpers/throwaway-profile.ts";
const RUNS_SOURCE = ["unit", "integration"];

function projectsRunningSource(
  projects: readonly unknown[]
): { name: string; globalSetup: unknown }[] {
  return projects.flatMap((project) => {
    const test = (project as { test?: { name?: string; globalSetup?: unknown } }).test;
    return test?.name && RUNS_SOURCE.includes(test.name)
      ? [{ name: test.name, globalSetup: test.globalSetup }]
      : [];
  });
}

describe("every project that runs the source sees a throwaway profile", () => {
  it.each([
    ["the suite", projectsRunningSource(config.test?.projects ?? [])],
    ["a mutation run", projectsRunningSource(mutation.test?.projects ?? [])],
  ])(
    "%s declares the throwaway-profile setup on its unit and integration projects",
    (_run, projects) => {
      expect(projects.map((p) => p.name).sort()).toStrictEqual(["integration", "unit"]);
      for (const project of projects) expect(project.globalSetup, project.name).toContain(SETUP);
    }
  );
});
