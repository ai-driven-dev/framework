// Draws the SDLC chain shown in the README as a pair of SVG files (light and dark) and the markup
// that lays it out. The steps, their one-word notes and the two loops are written once, in
// docs/assets/diagrams/sdlc.json, so the picture cannot drift from the skills it names.

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
const WIDTH = 640;
const PANEL_WIDTH = 520;
const PAD = 26;
const CHIP_WIDTH = 100;
const CHIP_HEIGHT = 34;
const GAP = 22;
const PANEL_HEIGHT = 122;
const PANEL_GAP = 34;
const CHIP_TOP = 54;

const THEMES = {
  light: {
    panel: "#f0f3f7",
    border: "#d1d9e0",
    muted: "#4a5560",
    line: "#6b7686",
    loop: "#d97706",
    zones: { Frame: "#0b7285", Deliver: "#6f42c1", Check: "#c2410c" },
  },
  dark: {
    panel: "#161b26",
    border: "#2f3a4d",
    muted: "#b6c0cc",
    line: "#8b97a8",
    loop: "#f5a524",
    zones: { Frame: "#0e8aa1", Deliver: "#8a63d2", Check: "#d9622b" },
  },
};

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function text(x, y, content, { size = 12, weight = 400, anchor = "start", fill, spacing }) {
  const extra = spacing ? ` letter-spacing="${spacing}"` : "";
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}"${extra} fill="${fill}">${escapeXml(content)}</text>`;
}

function path(d, color, { dashed = false, head }) {
  const dash = dashed ? ' stroke-dasharray="5 4"' : "";
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"${dash} marker-end="url(#${head})"/>`;
}

function marker(id, color) {
  return `<marker id="${id}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto" markerUnits="strokeWidth"><path d="M0 0 10 5 0 10Z" fill="${color}"/></marker>`;
}

export function chainSvg(diagram, themeName) {
  const theme = THEMES[themeName];
  const body = [];
  const centers = {};
  let top = 0;
  const middles = {};

  diagram.zones.forEach((zone, index) => {
    const color = theme.zones[zone.name];
    const chipTop = top + CHIP_TOP;
    middles[zone.name] = top + PANEL_HEIGHT / 2;
    body.push(
      `<rect x="0.5" y="${top + 0.5}" width="${PANEL_WIDTH - 1}" height="${PANEL_HEIGHT - 1}" rx="16" fill="${theme.panel}" stroke="${theme.border}"/>`,
      `<rect x="0.5" y="${top + 0.5}" width="8" height="${PANEL_HEIGHT - 1}" rx="4" fill="${color}"/>`,
      text(PAD, top + 25, zone.name.toUpperCase(), { size: 11.5, weight: 700, spacing: 1, fill: theme.muted })
    );
    zone.steps.forEach((step, position) => {
      const x = PAD + position * (CHIP_WIDTH + GAP);
      centers[step.label] = x + CHIP_WIDTH / 2;
      body.push(
        `<rect x="${x}" y="${chipTop}" width="${CHIP_WIDTH}" height="${CHIP_HEIGHT}" rx="12" fill="${color}"/>`,
        text(x + CHIP_WIDTH / 2, chipTop + 22, step.label, { size: 12.5, weight: 700, anchor: "middle", fill: "#ffffff" }),
        text(x + CHIP_WIDTH / 2, chipTop + CHIP_HEIGHT + 15, step.note, { size: 10.5, anchor: "middle", fill: theme.muted })
      );
      if (position < zone.steps.length - 1) {
        body.push(path(`M${x + CHIP_WIDTH + 3} ${chipTop + CHIP_HEIGHT / 2}h${GAP - 6}`, theme.line, { head: "line" }));
      }
    });
    if (index < diagram.zones.length - 1) {
      const last = PAD + (zone.steps.length - 1) * (CHIP_WIDTH + GAP) + CHIP_WIDTH / 2;
      const next = PAD + CHIP_WIDTH / 2;
      const turn = top + PANEL_HEIGHT + 17;
      const r = 10;
      body.push(
        path(`M${last} ${top + PANEL_HEIGHT + 1}V${turn - r}Q${last} ${turn} ${last - r} ${turn}H${next + r}Q${next} ${turn} ${next} ${turn + r}V${top + PANEL_HEIGHT + 31}`, theme.line, { head: "line" })
      );
    }
    top += PANEL_HEIGHT + PANEL_GAP;
  });

  const { from, to, label } = diagram.repeat;
  const deliverTop = PANEL_HEIGHT + PANEL_GAP;
  const loopTop = deliverTop + CHIP_TOP - 14;
  const r = 8;
  body.push(
    path(`M${centers[from]} ${deliverTop + CHIP_TOP - 3}V${loopTop + r}Q${centers[from]} ${loopTop} ${centers[from] - r} ${loopTop}H${centers[to] + r}Q${centers[to]} ${loopTop} ${centers[to]} ${loopTop + r}V${deliverTop + CHIP_TOP - 4}`, theme.loop, { dashed: true, head: "loop" }),
    text((centers[from] + centers[to]) / 2, deliverTop + 25, label, { size: 11, weight: 700, anchor: "middle", fill: theme.loop })
  );

  const back = diagram.return;
  const edge = PANEL_WIDTH + 36;
  const fromY = middles[back.from];
  const toY = middles[back.to];
  const bend = 12;
  body.push(
    path(`M${PANEL_WIDTH + 4} ${fromY}H${edge - bend}Q${edge} ${fromY} ${edge} ${fromY - bend}V${toY + bend}Q${edge} ${toY} ${edge - bend} ${toY}H${PANEL_WIDTH + 6}`, theme.loop, { dashed: true, head: "loop" })
  );
  back.label.forEach((line, index) => {
    body.push(text(edge + 10, fromY - 34 + index * 15, line, { size: 11.5, weight: 700, fill: theme.loop }));
  });

  const height = top - PANEL_GAP;
  const title = description(diagram);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <defs>${marker("line", theme.line)}${marker("loop", theme.loop)}</defs>
  ${body.join("\n  ")}
</svg>
`;
}

function description(diagram) {
  const zones = diagram.zones.map((zone) => `${zone.name}: ${zone.steps.map((step) => step.label).join(", ")}`);
  return `${zones.join(". ")}. ${diagram.repeat.from} repeats until checks pass, and Check findings go back to ${diagram.return.to}.`;
}

export function chainMarkup(diagram, base) {
  return `<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="${base}-dark.svg"><img src="${base}-light.svg" alt="${escapeXml(description(diagram))}" width="${WIDTH}"></picture></p>`;
}
