import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  NO_NOTES_TAG,
  NOTES,
  NOTES_TAG,
  PRIVATE_REPO,
  RELEASE_TAGS,
  RELEASES_REPO,
} from "./run-release-lister.contract.js";

/** The one token the private repository accepts. */
export const PRIVATE_TOKEN = "private-token";

const LISTING = /^\/repos\/(.+?)\/releases$/;
const BY_TAG = /^\/repos\/(.+?)\/releases\/tags\/(.+)$/;

type Reply = readonly [status: number, body: unknown];

const NOT_FOUND: Reply = [404, {}];

/** What the forge holds for a repository: its releases, or the one release of a tag. */
function releasesOf(repo: string, tag: string | null): Reply {
  if (repo !== RELEASES_REPO) return NOT_FOUND;
  if (tag === null) return [200, RELEASE_TAGS.map((tag_name) => ({ tag_name }))];
  if (tag === NOTES_TAG) return [200, { tag_name: tag, body: NOTES }];
  return tag === NO_NOTES_TAG ? [200, { tag_name: tag, body: null }] : NOT_FOUND;
}

function mayRead(req: IncomingMessage, repo: string): boolean {
  return repo !== PRIVATE_REPO || req.headers.authorization === `Bearer ${PRIVATE_TOKEN}`;
}

function replyTo(req: IncomingMessage): Reply {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const listing = LISTING.exec(url.pathname);
  const byTag = BY_TAG.exec(url.pathname);
  const repo = listing?.[1] ?? byTag?.[1];
  if (repo === undefined) return NOT_FOUND;
  if (!mayRead(req, repo)) return [401, {}];
  // GitHub pages at 30 by default: only a request for the maximum sees every release.
  if (listing && url.searchParams.get("per_page") !== "100") return [400, {}];
  // The private repository holds what the public one does, behind its token.
  return releasesOf(repo === PRIVATE_REPO ? RELEASES_REPO : repo, byTag?.[2] ?? null);
}

function serve(req: IncomingMessage, res: ServerResponse): void {
  const [status, body] = replyTo(req);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** A GitHub releases API on a free local port, serving the contract's world. */
export function startLocalReleases(): Promise<{ apiBase: string; close: () => Promise<void> }> {
  const server = createServer(serve);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("the local releases API is not listening on a port"));
        return;
      }
      resolve({
        apiBase: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
