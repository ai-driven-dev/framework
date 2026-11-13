import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { GitHubAdapter } from "../../../../src/contexts/auth/infrastructure/github-adapter.js";
import { HttpClient } from "../../../../src/shared/infrastructure/http-client.js";
import { FakeIdentityVerifier } from "../testing/fake-identity-verifier.js";
import {
  describeIdentityVerifierContract,
  type VerifierSubject,
} from "../testing/identity-verifier-contract.js";

const KNOWN = "ghp_known";
const REFUSED = "ghp_refused";
const LOGIN = "octocat";

describeIdentityVerifierContract(
  "the fake",
  async (): Promise<VerifierSubject> => ({
    verifier: new FakeIdentityVerifier({ [KNOWN]: LOGIN }),
    knownToken: KNOWN,
    login: LOGIN,
    refusedToken: REFUSED,
    dispose: async () => undefined,
  })
);

/** A recorded `GET /user` answer: the fields GitHub sends, the login among them. */
const USER_BODY = JSON.stringify({ login: LOGIN, id: 583231, type: "User", site_admin: false });

async function serveUser(): Promise<Server> {
  const server = createServer((request, response) => {
    const known = request.headers.authorization === `Bearer ${KNOWN}`;
    response.writeHead(known ? 200 : 401, { "Content-Type": "application/json" });
    response.end(known ? USER_BODY : JSON.stringify({ message: "Bad credentials" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

describeIdentityVerifierContract(
  "GitHubAdapter over a local server",
  async (): Promise<VerifierSubject> => {
    const server = await serveUser();
    const { port } = server.address() as AddressInfo;
    return {
      verifier: new GitHubAdapter(new HttpClient(), `http://127.0.0.1:${port}`),
      knownToken: KNOWN,
      login: LOGIN,
      refusedToken: REFUSED,
      dispose: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
  }
);
