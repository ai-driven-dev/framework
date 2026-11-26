import { scanRecipe } from "./markdown-scan.js";

function baseSlug(text: string): string {
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1");
  let plain = "";
  let tagDepth = 0;
  for (const character of text) {
    if (character === "<") tagDepth += 1;
    else if (character === ">") tagDepth = Math.max(0, tagDepth - 1);
    else if (tagDepth === 0) plain += character;
  }
  return plain
    .toLowerCase()
    .replace(/[`*_~]/gu, "")
    .replace(/[\u200d\ufe0e\ufe0f]/gu, "")
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
    .replace(/\s/gu, "-");
}

export function headingAnchors(content: string): Set<string> {
  const counts = new Map<string, number>();
  const anchors = new Set<string>();

  for (const heading of scanRecipe(content, () => {}).headings) {
    const slug = baseSlug(heading.text);
    const count = counts.get(slug) ?? 0;
    counts.set(slug, count + 1);
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
  }
  return anchors;
}

export function normalizedAnchor(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/^#/u, ""))
      .toLowerCase()
      .replace(/[\u200d\ufe0e\ufe0f]/gu, "");
  } catch {
    return raw
      .replace(/^#/u, "")
      .toLowerCase()
      .replace(/[\u200d\ufe0e\ufe0f]/gu, "");
  }
}
