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
      ],
    ],
  },
};
