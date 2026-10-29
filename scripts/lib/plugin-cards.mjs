// Draws one card per plugin as a pair of SVG files (light and dark) and the README markup that
// lays them out. Counts come from the tree and the words from docs/assets/plugins/plugins.json,
// so a card cannot drift from the plugin it names.

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
const WIDTH = 292;
const HEIGHT = 196;
const BAND = 78;
const LINE_LIMIT = 34;

const THEMES = {
  light: { surface: "#ffffff", border: "#d1d9e0", muted: "#4a5560", text: "#1f2328" },
  dark: { surface: "#1f2735", border: "#3a4558", muted: "#b6c0cc", text: "#f0f6fc" },
};

const STATUS_COLORS = { stable: "#1a7f37", beta: "#9a6700", alpha: "#cf222e", new: "#0969da" };

/** Line icons on a 24 by 24 grid, drawn with the plugin's accent as stroke. */
const ICONS = {
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
  code: '<path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/><path d="m14 4-4 16"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10"/><path d="M18 11c0 4-6 3-12 6"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 11 1.5 1.5L14 9"/><path d="M9 17h6"/>',
  mirror: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  flow: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4"/><path d="M5 17v-3h14v3"/>',
  window: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 13h8"/><path d="M8 16h5"/>',
  bars: '<path d="M5 20V13"/><path d="M12 20V6"/><path d="M19 20V10"/><path d="M3 20h18"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/>',
};

function hex(color) {
  return [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
}

function mix(color, other, amount) {
  const [a, b] = [hex(color), hex(other)];
  return `#${a.map((channel, i) => Math.round(channel + (b[i] - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(text) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > LINE_LIMIT) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 2) throw new Error(`description does not fit two lines: ${text}`);
  return lines;
}

export function cardSvg(plugin, entry, skills, themeName) {
  const theme = THEMES[themeName];
  const accent = entry.accent;
  const accentLight = mix(accent, "#ffffff", 0.28);
  const status = themeName === "dark" ? mix(STATUS_COLORS[entry.status], "#ffffff", 0.35) : STATUS_COLORS[entry.status];
  const label = entry.status.toUpperCase();
  const pillWidth = 26 + label.length * 8;
  const lines = wrap(entry.description);
  const count = `${skills} ${skills === 1 ? "skill" : "skills"}`;
  const title = `${plugin}, ${entry.status}, ${count}: ${entry.description}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <defs>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="${accentLight}"/>
    </linearGradient>
    <clipPath id="card"><rect width="${WIDTH}" height="${HEIGHT}" rx="16"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${theme.surface}"/>
    <rect width="${WIDTH}" height="${BAND}" fill="url(#band)"/>
  </g>
  <rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="16" fill="none" stroke="${theme.border}"/>
  <rect x="20" y="17" width="44" height="44" rx="13" fill="#ffffff" fill-opacity="0.24"/>
  <g transform="translate(30 27)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[entry.icon]}</g>
  <text x="78" y="38" font-family="${FONT}" font-size="19" font-weight="700" fill="#ffffff">${escapeXml(plugin)}</text>
  <text x="78" y="58" font-family="${FONT}" font-size="13.5" fill="#ffffff" fill-opacity="0.92">${count}</text>
  ${lines.map((line, i) => `<text x="20" y="${110 + i * 21}" font-family="${FONT}" font-size="14.5" fill="${theme.text}">${escapeXml(line)}</text>`).join("\n  ")}
  <rect x="20" y="160" width="${pillWidth}" height="22" rx="11" fill="${status}" fill-opacity="0.17"/>
  <text x="${20 + pillWidth / 2}" y="175" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="0.9" fill="${status}">${label}</text>
</svg>
`;
}

export function cardsMarkup(plugins) {
  const cards = plugins.map(({ plugin, entry, skills }) => {
    const count = `${skills} ${skills === 1 ? "skill" : "skills"}`;
    const alt = escapeXml(`${plugin}, ${entry.status}, ${count}: ${entry.description}`);
    const base = `docs/assets/plugins/${plugin}`;
    return `<a href="plugins/${plugin}/README.md"><picture><source media="(prefers-color-scheme: dark)" srcset="${base}-dark.svg"><img src="${base}-light.svg" alt="${alt}" width="${WIDTH}"></picture></a>`;
  });
  return `<p align="center">\n${cards.join("\n")}\n</p>`;
}
