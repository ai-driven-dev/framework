import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { treeSnapshot } from "../../skill-eval-snapshot.mjs";

const root = process.env.AIDD_SNAPSHOT_ROOT;
const target = process.env.AIDD_SNAPSHOT_TARGET;
const backup = `${target}.original`;
const originalOpen = fs.openSync;
let replaced = false;

fs.openSync = function (file, ...args) {
  if (!replaced && file === target) {
    replaced = true;
    fs.renameSync(target, backup);
    fs.writeFileSync(target, "substituted bytes");
  }
  return originalOpen.call(this, file, ...args);
};
syncBuiltinESMExports();

try {
  treeSnapshot(root);
  console.error("snapshot accepted a substituted file");
  process.exitCode = 1;
} catch (error) {
  if (!/File changed while snapshotting/u.test(error.message)) throw error;
  console.log("snapshot refused a substituted file");
}
