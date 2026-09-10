// Conventional Commits for this repo (docs/git-workflow.md).
// `infra` is extra vs the default set — Terraform/GCP PRs use it.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // GitHub wraps text; a 100-char line cap is leftover terminal habit.
    // Keep the subject short. Body and footer may be long (why / context).
    // A Co-authored-by trailer makes commitlint treat the body as footer.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'docs',
        'infra',
        'test',
        'ci',
        'refactor',
        'style',
        'perf',
        'build',
        'revert',
      ],
    ],
  },
};
