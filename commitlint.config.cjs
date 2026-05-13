module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "aidd-context",
        "aidd-dev",
        "aidd-vcs",
        "aidd-pm",
        "aidd-refine",
        "aidd-orchestrator",
        "framework",
        "marketplace",
      ],
    ],
    "body-max-line-length": [0, "always"],
    "footer-max-line-length": [0, "always"],
  },
};
