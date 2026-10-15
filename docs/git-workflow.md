# Nissim — Git Workflow & Deployment Policy

מסמך מדיניות. ה-workflows יושבים ב-`.github/workflows/`. הגדרות ה-environment
ו-branch protection יושבות ב-`infra/terraform/github/` ומוחלות ידנית — אין
GitHub token ב-repo, ו-`deploy.yml` לא מריץ apply על ה-root הזה.

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
- Terraform — `fmt -check -recursive` + `validate` על bootstrap, על
  environments/{dev,prod}, ועל `github/`. ה-job רץ בכל PR (זול) — לא
  `paths:` filter — כדי ש-required check לא יישאר "skipped" ב-PRs שלא
  נוגעים ב-`infra/` ויחסום merge.
- Terraform plan — job נפרד בשם `Terraform plan`. כש-`WIF_PROVIDER` ו-
  `WIF_SERVICE_ACCOUNT` מוגדרים על environment `dev`, הוא מריץ
  `terraform plan` ל-dev ול-prod (בלי apply) ומגיב על ה-PR. כשאחד מהם
  ריק, ה-job מסומן skipped ולא נכשל. **הוא לא required check** עד
  שהמשתנים קיימים וה-job באמת רץ ירוק. ראו את נתיב הקליקים למטה.
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
  → checks רצים (lint/typecheck/test/docker/terraform fmt+validate/commitlint)
  → Terraform plan: skipped כל עוד WIF ריק; כשהוא רץ — plan בלבד + תגובה על ה-PR
  → merge ל-main (ידני, אחרי required checks ירוקים; plan אינו required)
  → deploy ל-dev (שוב, מ-main)
  → gate: אישור ידני (GitHub Environment "prod" + required reviewer)
  → deploy ל-prod
```

**dev**: כל branch יכול להיפרס ל-dev (בדיקת פיצ'ר על סביבה אמיתית).
אין preview per-PR — יש סביבת dev אחת, אז שני בראנצ'ים לא יכולים
לשבת שם במקביל. `workflow_dispatch` מאפשר להריץ דיפלוי מבראנץ' בלי פוש חדש.

**prod**: רק מ-`main`. environment נפרד עם required reviewer — ה-job
עוצר וממתין לאישור ידני. פיצ'ר branch לעולם לא נוגע ב-prod.

## מיפוי ל-Terraform/CI-CD
- Branch protection על `main` — `github_branch_protection` ב-
  `infra/terraform/github/`. ה-contexts הם שמות ה-jobs, לא שם ה-workflow:
  `Lint`, `Typecheck`, `Tests`, `Docker`, `Commitlint`, `Terraform`.
  בלי `Terraform plan`. בלי required approving reviews.
- Environments (`dev` בלי reviewer, `prod` עם reviewer) —
  `github_repository_environment` באותו root. Apply מקומי, לא מ-CI.
- GitHub Actions — רק תחת `.github/workflows/` (GitHub לא מריץ YAML מתיקייה
  אחרת). שני קבצים, לפי אחריות:
  - `.github/workflows/ci.yml` — PR checks (lint/typecheck/test/docker/
    commitlint/terraform fmt+validate) ו-job נפרד `Terraform plan` שאינו required
  - `.github/workflows/deploy.yml` — dev מכל branch (+ `workflow_dispatch`);
    prod רק מ-`main` עם GitHub Environment + required reviewer.
    התמונה נדחפת ל-`nissim-dev` או `nissim-prod`.
  אין `pr-review.yml` (decision #17).

## WIF — נתיב קליקים

ה-plan וה-deploy לא רצים עד שהמשתנים קיימים. משתנה ריק → ה-job skipped,
לא אדום. שמים את הערכים תחת **Variables**, לא תחת Secrets: ה-workflow
קורא `vars`. לא שמים token, JSON key, או את הערכים עצמם בקובץ ב-repo.

1. Bootstrap כבר יצר את bucket ה-state (`nissim-garden-tfstate`). Apply
   מקומי, עם login ל-GCP, קודם ב-`infra/terraform/environments/dev` ואחר
   כך ב-`environments/prod`. צריך `TF_VAR_billing_account_id` ב-shell
   (צורה `012345-6789AB-CDEF01`, לא סוד). לא מריצים `terraform apply`
   מ-pull request.
2. בכל root: `terraform output -raw workload_identity_provider` ו-
   `terraform output -raw github_actions_service_account`. ל-dev ול-prod
   יש ערכים שונים. ה-service account הוא `github-actions-dev@nissim-garden.iam.gserviceaccount.com`
   או `github-actions-prod@...`. מדביקים את ה-output, לא ממציאים שרשור.
3. Apply מקומי ל-`infra/terraform/github`. ב-shell: `GITHUB_TOKEN` עם
   הרשאת administration על הריפו (classic PAT scope `repo`, או
   fine-grained עם Administration read/write). ה-token נשאר ב-environment
   של המעטפת. Environment `dev` כבר קיים — ה-config מייבא אותו. `prod`
   נוצר כאן, עם reviewer וללא אישור אנושי על PR. אם branch protection
   כבר קיים וה-apply נכשל כי הוא קיים:
   `terraform import github_branch_protection.main nissim-smart-garden:main`.
4. קליקים, פעם ל-`dev` ופעם ל-`prod`:
   - דף הריפו → **Settings** → **Environments** → שם ה-environment.
   - **Environment variables** → **Add variable**. לא Secrets.
   - `WIF_PROVIDER` — ה-output של **אותו** environment.
   - `WIF_SERVICE_ACCOUNT` — ה-output של **אותו** environment.
   - על `dev` בלבד, גם `TF_VAR_billing_account_id` — אותו מזהה חשבון
     ששימש ל-apply. ה-plan קורא אותו מ-environment `dev`.
5. ב-`dev` אין required reviewer, וכל branch יכול להיפרס. ב-`prod` ה-reviewer
   הוא `roeebracha` (`prevent_self_review = false`, כדי שאופרטור יחיד יוכל
   לאשר דיפלוי שהוא עצמו הפעיל). `deployment_branch_policy` מאפשר רק branch
   מוגן, ומוגן רק `main`. `deploy.yml` גם בודק `github.ref == refs/heads/main`.
6. Re-run על PR. ה-job `Terraform plan` צריך לעבור מ-skipped לריצה. הוא
   מתחבר עם ה-WIF של **dev** (ה-pool של prod דורש `refs/heads/main`,
   ו-`pull_request` שולח `refs/pull/N/merge`), מריץ `terraform plan` בשני
   ה-roots, ולא מריץ apply. תגובה אחת על ה-PR מתעדכנת בכל ריצה.
7. רק אחרי שה-job הזה ירוק על PR אמיתי מוסיפים את `Terraform plan`
   ל-`required_status_checks`. עד אז skip הוא המצב הנורמלי, ו-required
   check שהוא skipped חוסם merge. שמות ה-checks שכן נדרשים כתובים למעלה.
