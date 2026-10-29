import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileState(left, right) {
  return sameIdentity(left, right) && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

function readStableFile(file) {
  // O_NOFOLLOW is available on POSIX. On Windows, the post-open identity checks
  // provide the fallback; the descriptor still pins the opened file for reads.
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
  const fd = openSync(file, flags);
  try {
    const openedState = fstatSync(fd, { bigint: true });
    if (!openedState.isFile()) {
      throw new Error(`File changed while snapshotting: ${file}`);
    }

    const contents = readFileSync(fd);
    const finalState = fstatSync(fd, { bigint: true });
    const finalPathState = lstatSync(file, { bigint: true });
    if (!sameFileState(openedState, finalState) || !sameIdentity(finalState, finalPathState)) {
      throw new Error(`File changed while snapshotting: ${file}`);
    }
    return `${finalState.mtimeNs}:${contents.toString("base64")}`;
  } finally {
    closeSync(fd);
  }
}

export function treeSnapshot(root) {
  const snapshot = new Map();
  const walk = (dir, prefix = "") => {
    const directoryState = lstatSync(dir, { bigint: true });
    if (!directoryState.isDirectory()) throw new Error(`Directory changed while snapshotting: ${dir}`);

    const entries = readdirSync(dir, { withFileTypes: true }).sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (relative === ".skill-eval-last-message.txt") continue;
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        const childState = lstatSync(file, { bigint: true });
        if (!childState.isDirectory()) throw new Error(`Directory changed while snapshotting: ${file}`);
        snapshot.set(`${relative}/`, `directory:${Number(childState.mtimeNs) / 1e6}`);
        walk(file, relative);
        if (!sameIdentity(childState, lstatSync(file, { bigint: true }))) {
          throw new Error(`Directory changed while snapshotting: ${file}`);
        }
      } else if (entry.isFile()) {
        snapshot.set(relative, readStableFile(file));
      } else {
        snapshot.set(relative, `other:${entry.isSymbolicLink()}`);
      }
    }

    // Node's portable path-based directory APIs do not expose a dirfd-relative
    // walk. Rechecking identity catches ordinary directory replacement races;
    // file bytes themselves are read through a pinned descriptor above.
    if (!sameIdentity(directoryState, lstatSync(dir, { bigint: true }))) {
      throw new Error(`Directory changed while snapshotting: ${dir}`);
    }
  };
  walk(root);
  return snapshot;
}
