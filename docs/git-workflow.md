# Nissim — Git Workflow & Deployment Policy

מסמך מדיניות שיתורגם בהמשך להגדרות Terraform (GitHub provider) ו-GitHub Actions
בפועל. השינויים בו הם decision, לא implementation — המימוש מגיע בשלב ה-CI/CD
וה-Terraform ב-roadmap (ראו `architecture.md`).

## Branching model — trunk-based
`main` מוגן (protected branch). כל שינוי דרך branch קצר-מועד:
- `feature/<name>` — פיצ'ר חדש
- `fix/<name>` — תיקון באג
- `infra/<name>` — שינוי ב-Terraform/תשתית

בלי GitFlow (develop/release branches) — זה מיועד למוצרים עם כמה גרסאות
במקביל, לא רלוונטי לפרויקט הזה.

## Commit convention — Conventional Commits
פורמט: `<type>: <description>` — `feat:`, `fix:`, `chore:`, `docs:`, `infra:`,
`test:`. נאכף כ-check אוטומטי על כל PR (commitlint).

- **Subject** — שורה אחת קצרה (type + מה השתנה). זה מה שנכנס ל-changelog.
- **Body** — רצוי, ויכול להיות ארוך: *למה* (החלטה, trade-off, מה לא עושים).
  זה הקונטקסט ל-`git log` ולאנשים/AI שחוזרים להיסטוריה. שבירת שורות
  נוחה לקריאה, לא חובה בשביל CI.
- **Footer** — אופציונלי (`Fixes #12`). בלי `Co-authored-by` של כלי AI —
  זה רעש בהיסטוריה ולפעמים גורם ל-commitlint לסווג את ה-body כ-footer.

אורך שורות ב-body וב-footer לא מוגבל (`body-max-line-length` ו-
`footer-max-line-length` כבויים ב-`commitlint.config.mjs`). GitHub עוטף
לבד. מאפשר בעתיד changelog/versioning אוטומטי מהיסטוריית ה-commits.

## PR checks (required status checks)
כל PR חייב לעבור לפני merge (`.github/workflows/ci.yml`):
- Lint — `npm run lint:check` ב-backend (eslint, בלי `--fix`). אין frontend עדיין.
- Type check — `npm run typecheck` (`tsc --noEmit`)
- Unit tests — jest (`--passWithNoTests` כל עוד אין `*.spec.ts`)
- `docker build` של `backend/`
- Terraform — `fmt -check -recursive` + `validate` על bootstrap ועל
  environments/{dev,prod}. **plan + comment על ה-PR עדיין לא רץ**:
  קונפיג הסביבות הוא שלד, ו-plan מול GCP דורש WIF. יתווסף כששני אלה קיימים.
  ה-job רץ בכל PR (זול) — לא `paths:` filter — כדי ש-required check לא יישאר
  "skipped" ב-PRs שלא נוגעים ב-`infra/` ויחסום merge.
- commitlint — Conventional Commits, כולל type `infra` (`commitlint.config.mjs`)

## Approval policy — required checks בלבד, בלי human approval פורמלי
זה **פרויקט של אדם אחד** — GitHub לא סופר אישור של מחבר ה-PR לעצמו לכיוון
דרישת "require approvals", כך שדרישת אישור אנושי פורמלית תיתקע פרויקט סולו.
לכן: **ה-gate הוא ה-checks בלבד**. merge מתבצע ידנית אחרי שכל ה-checks ירוקים.
זו הפרקטיקה המקובלת לריפואים אישיים גם בחברות אמיתיות (side tools פנימיים).

## Environments ו-deployment flow

```
פוש לכל branch (או Run workflow ידני)
  → deploy ל-dev (סביבה משותפת אחת — הבראנץ' האחרון שמצליח דורס את הקודם)

PR נפתח
  → checks רצים (lint/tests/build/terraform validate/commitlint)
  → merge ל-main (ידני, אחרי checks ירוקים)
  → deploy ל-dev (שוב, מ-main)
  → gate: אישור ידני (GitHub Environment "prod" + required reviewer)
  → deploy ל-prod
```

**dev**: כל branch יכול להיפרס ל-dev (בדיקת פיצ'ר על סביבה אמיתית).
אין preview per-PR — יש סביבת dev אחת, אז שני בראנצ'ים לא יכולים
לשבת שם במקביל. `workflow_dispatch` מאפשר להריץ דיפלוי מבראנץ' בלי פוש חדש.

**prod**: רק מ-`main`. environment נפרד עם required reviewer — ה-job
עוצר וממתין לאישור ידני. פיצ'ר branch לעולם לא נוגע ב-prod.

## מיפוי ל-Terraform/CI-CD (roadmap שלבים 2–3)
- Branch protection על `main` — משאב `github_branch_protection` (GitHub provider)
- Environments (`dev`, `prod`) + required reviewers על `prod` —
  `github_repository_environment`
- GitHub Actions — רק תחת `.github/workflows/` (GitHub לא מריץ YAML מתיקייה
  אחרת). שני קבצים, לפי אחריות:
  - `.github/workflows/ci.yml` — PR checks (lint/typecheck/test/docker/
    commitlint/terraform fmt+validate; plan יתווסף אחרי WIF + קונפיג סביבות)
  - `.github/workflows/deploy.yml` — dev מכל branch (+ `workflow_dispatch`);
    prod רק מ-`main` עם GitHub Environment + required reviewer
  אין `pr-review.yml` (decision #17).
