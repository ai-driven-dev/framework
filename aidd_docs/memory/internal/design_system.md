# Design System - AIDD CLI

## Skipped

This deliverable was skipped because a traditional design system does not apply to AIDD CLI.

**Rationale**: AIDD CLI is a terminal-only command-line tool with no graphical user interface. The design system template covers visual tokens (colors, typography, spacing), GUI components (buttons, inputs, modals), navigation patterns (sidebars, tabs), wireframes, and responsive behavior. None of these concepts apply to a CLI where:

- The terminal emulator controls all visual rendering (font, colors, background).
- There are no interactive GUI components to specify.
- There are no layouts, navigation patterns, or wireframes.
- Spacing and typography are governed by the terminal's monospace grid.

**What is covered elsewhere**:

- Terminal output formatting conventions (status indicators, indentation, prefixes) are defined in `ux_copy.md`, section 11.
- User flows through CLI commands are defined in `user_flows.md`.
