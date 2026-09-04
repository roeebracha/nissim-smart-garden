// Conventional Commits for this repo (docs/git-workflow.md).
// `infra` is extra vs the default set — Terraform/GCP PRs use it.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
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
