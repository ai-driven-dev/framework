/** git writes `Branch: renamed` or `Branch: copied`; libgit2, behind many git clients,
 * `branch: renamed`. */
const TOOK_NAME = /^branch: (renamed|copied) /i;

function selectorTime(selector: string): string | null {
  const open = selector.lastIndexOf("@{");
  if (open === -1 || !selector.endsWith("}")) return null;
  const instant = Date.parse(selector.slice(open + 2, -1));
  return Number.isNaN(instant) ? null : new Date(instant).toISOString();
}

/** When the branch took its name, from `git reflog show --date=iso-strict --format=%gd%x09%gs`:
 * newest first, each `<selector>@{<time>}`, a tab, the entry's subject. A copy or a rename
 * (`git branch -c`, `-m`, `-C`, `-M`) brings the source's reflog along, so the newest entry
 * where the branch arrived under this name is its start; otherwise the oldest entry is its
 * creation. A name used before keeps its earlier work apart from what came after. */
export function branchCreatedAt(output: string, branch: string): string | null {
  const lines = output.split("\n").filter((line) => line !== "");
  const arrived = ` to refs/heads/${branch}`;
  const tookName = lines.find((line) => {
    const subject = line.slice(line.indexOf("\t") + 1);
    return TOOK_NAME.test(subject) && subject.endsWith(arrived);
  });
  const entry = tookName ?? lines.at(-1);
  if (entry === undefined) return null;
  const tab = entry.indexOf("\t");
  return selectorTime(tab === -1 ? entry : entry.slice(0, tab));
}
