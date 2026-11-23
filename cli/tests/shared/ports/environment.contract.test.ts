import { EnvironmentAdapter } from "../../../src/shared/infrastructure/environment-adapter.js";
import { InMemoryEnvironment } from "../testing/in-memory-environment.fake.js";
import { describeEnvironmentContract } from "../testing/run-environment.contract.js";

describeEnvironmentContract("the in-memory double", (values) => ({
  environment: new InMemoryEnvironment(values),
  dispose: () => undefined,
}));

describeEnvironmentContract("the process environment", (values) => {
  Object.assign(process.env, values);
  return {
    environment: new EnvironmentAdapter(process.env),
    dispose: () => {
      for (const name of Object.keys(values)) delete process.env[name];
    },
  };
});
