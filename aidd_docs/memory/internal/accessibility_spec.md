# Accessibility Specification - AIDD CLI

## Skipped

This deliverable was skipped because ARIA, keyboard navigation, focus management, and contrast specifications do not apply to AIDD CLI.

**Rationale**: AIDD CLI is a terminal-only command-line tool. Accessibility for CLI applications is handled at the terminal emulator level, not the application level:

- **ARIA roles and attributes**: There is no DOM. Terminal output is plain text consumed by screen readers through the terminal emulator's accessibility layer.
- **Keyboard navigation**: There are no interactive UI components. Users type commands and read output. The terminal handles all keyboard input.
- **Focus management**: There are no focusable elements, modals, or dynamic content regions. CLI output is linear text.
- **Contrast ratios**: The terminal emulator controls foreground/background colors. The CLI does not render pixels.
- **Skip links and landmarks**: There is no page structure to navigate.

**What the CLI does for accessibility**:

- All output is plain text, readable by any screen reader that supports terminal emulators.
- Error messages go to stderr, success output to stdout -- this separation is standard and expected by assistive tooling.
- The CLI avoids relying solely on color to convey information. Status indicators use text characters (`+`, `~`, `-`) alongside any potential color hints.
- All output is structured with consistent indentation and prefixes, making it parseable by screen readers and automation tools alike.

These conventions are documented in `ux_copy.md`, section 11 (Output Formatting Conventions).
