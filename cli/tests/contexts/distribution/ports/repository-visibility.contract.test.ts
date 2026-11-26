import { GitHubAdapter } from "../../../../src/shared/infrastructure/github-adapter.js";
import { HttpClient } from "../../../../src/shared/infrastructure/http-client.js";
import { startLocalGitHub } from "../testing/local-github-server.builder.js";
import { describeRepositoryVisibilityContract } from "../testing/repository-visibility.contract.js";
import { InMemoryRepositoryVisibility } from "../testing/repository-visibility.fake.js";

describeRepositoryVisibilityContract("from memory", async () => ({
  visibility: new InMemoryRepositoryVisibility(),
  dispose: async () => {},
}));

describeRepositoryVisibilityContract("through the GitHub adapter on a local server", async () => {
  const { apiBase, close } = await startLocalGitHub();
  return { visibility: new GitHubAdapter(new HttpClient(), { apiBase }), dispose: close };
});
