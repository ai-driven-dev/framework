module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Type still validated by config-conventional (feat, fix, chore, docs, refactor, perf, test, build, ci, revert, style).
    // Scope is optional and free-form: any kebab-case slug (or empty) is accepted.
    "scope-case": [2, "always", "kebab-case"],
    "body-max-line-length": [0, "always"],
    "footer-max-line-length": [0, "always"],
  },
};
