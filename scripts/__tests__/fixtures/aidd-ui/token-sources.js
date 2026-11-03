// Token files of the code, in the shapes real projects hold, written for these tests alone: a
// stylesheet with `:root`, a `[data-theme]` block and `@media` overrides, and a script of camelCase
// literals. Their token sets are disjoint across themes, platforms and breakpoints, as T6 requires.
const WEB_CSS = `/* Tokens of the web app. */
:root {
  --color-ink: #1b1f23;
  --color-paper: #fbfaf7;
  --color-accent: #b4442c;
  --color-accent-hover: #8f3622;
  --color-veil: rgba(27, 31, 35, 0.6);
  --color-link: var(--color-accent);
  --color-glow: color-mix(in srgb, var(--color-accent) 30%, transparent);
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-gutter: clamp(1rem, 4vw, 3rem);
  --radius-control: 6px;
  --motion-fast: 150ms;
  --font-body: "Source Serif 4", Georgia, serif;
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.12),
    0 4px 12px rgba(0, 0, 0, 0.08);
  --font-size-body: 1rem;
  --font-size-title: 1.5rem;
}

[data-theme="dark"] {
  --color-paper: #14161a;
  --color-ink: #efece6;
}

@media (min-width: 48rem) {
  :root {
    --space-md: 1.5rem;
    --font-size-title: 2rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-fast: 0ms;
  }
}

.card {
  --card-pad: 12px;
}
`;

const MOBILE_TS = `// Tokens of the mobile app.
export const tokens = {
  colorInk: "#1b1f23",
  colorPaper: "#fbfaf7",
  colorAccent: "#b4442c",
  colorAccentHover: "#8f3622",
  spaceSm: 8,
  fontSizeBody: 17,
  radius: { control: 12 },
  labelCaps: caps("label"),
};
`;

module.exports = { WEB_CSS, MOBILE_TS };
