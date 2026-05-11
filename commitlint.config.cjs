module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "aidd-context",
        "aidd-dev",
        "aidd-orchestrator",
        "aidd-pm",
        "aidd-refine",
        "aidd-vcs",
        "framework",
        "marketplace",
      ],
    ],
  },
};
