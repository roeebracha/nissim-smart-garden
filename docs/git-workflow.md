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
`test:`. נאכף כ-check אוטומטי על כל PR (commitlint). מאפשר בעתיד
changelog/versioning אוטומטי מהיסטוריית ה-commits.

## PR checks (required status checks)
כל PR חייב לעבור לפני merge:
- Lint (ruff ל-Python, eslint ל-frontend)
- Type check
- Unit tests
- `docker build` מצליח
- ל-PR שנוגע ב-`infra/` בלבד: `terraform fmt` + `terraform validate` +
  `terraform plan` — תוצאת ה-plan מתפרסמת כ-comment אוטומטי על ה-PR
- commitlint (בדיקת conventional commits)

## AI review bot — `anthropics/claude-code-action`, advisory בלבד
GitHub Actions workflow נוסף (`on: pull_request`), רץ **במקביל** לצ'קים
למעלה אבל **לא חוסם merge** — תוצאת ה-check הזה לא נכנסת לרשימת ה-required
checks. הרציונל המלא (כולל למה לא נבנה בוט custom) ב-`architecture.md`
decision #8. בקצרה:
- `anthropics/claude-code-action@v1` — action רשמי, לא קוד custom.
- התקנה: `/install-github-app` מטרמינל Claude Code (דורש אישור אינטראקטיבי
  ידני — לא ניתן להריץ מ-session לא-אינטראקטיבי).
- checklist מותאם אישית ל-Nissim (12-factor + עקרונות מ-`architecture.md`).

## Approval policy — required checks בלבד, בלי human approval פורמלי
זה **פרויקט של אדם אחד** — GitHub לא סופר אישור של מחבר ה-PR לעצמו לכיוון
דרישת "require approvals", כך שדרישת אישור אנושי פורמלית תיתקע פרויקט סולו.
לכן: **ה-gate הוא ה-checks בלבד**. merge מתבצע ידנית אחרי שכל ה-checks ירוקים.
זו הפרקטיקה המקובלת לריפואים אישיים גם בחברות אמיתיות (side tools פנימיים).

## Environments ו-deployment flow

```
PR נפתח
  → checks רצים (lint/tests/build/terraform plan/commitlint)
  → merge ל-main (ידני, אחרי checks ירוקים)
  → deploy אוטומטי ל-staging
  → gate: אישור ידני (GitHub Environment "production" + required reviewer)
  → deploy ל-production
```

**staging**: deploy אוטומטי בכל merge ל-`main`, בלי אישור.
**production**: environment נפרד עם required reviewer — ה-workflow job עוצר
וממתין לאישור ידני לפני שהוא רץ מול production. זה בדיוק המנגנון שמייצג
"אישור שלי לדיפלוימנט" — לא הרשאת deploy כללית, אלא gate per-deployment.

## מיפוי עתידי ל-Terraform/CI-CD (לביצוע בשלבים 2-3 ב-roadmap)
- Branch protection על `main` — משאב `github_branch_protection` (GitHub provider)
- Environments (`staging`, `production`) + required reviewers —
  `github_repository_environment`
- GitHub Actions: workflow אחד ל-PR checks, workflow נפרד ל-deploy
  (staging job ללא gate, production job מול environment מוגן)
