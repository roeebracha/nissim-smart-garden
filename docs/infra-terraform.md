# Nissim — Terraform & GCP Infrastructure

מגדיר את מבנה ה-Terraform ואת החלטות ה-infra ב-GCP. ליחס בין הסביבות
(staging/production) ולתהליך ה-deploy עצמו ראו [`git-workflow.md`](./git-workflow.md).

## מבנה תיקיות
```
infra/terraform/
├── bootstrap/                    # state bucket + APIs בסיסיים, local state, פעם אחת
├── modules/
│   ├── network/                  # VPC, subnet, firewall
│   ├── database/                 # Cloud SQL instance + db + user
│   ├── artifact-registry/        # Docker registry
│   └── iam/                      # service accounts + Workload Identity Federation
└── environments/
    ├── staging/                  # root config -> modules, remote state ב-GCS
    └── production/
```
לא `terraform workspace` — HashiCorp ממליצים נגד זה להפרדת סביבות (סיכון
לערבוב state בטעות). תיקייה נפרדת per environment = state נפרד, בידוד אמיתי.

## Decision: פרויקט GCP אחד משותף ל-staging+production
משאבים מתויגים/משוימים per env בתוך אותו פרויקט (למשל `nissim-db-staging`).
נבחר לצורך עלות ופשטות בסקאלת פרויקט אישי — מודעים שזה פחות מבודד מ-2
פרויקטים נפרדים (שזו הפרקטיקה המלאה בארגון אמיתי, ותישקל שוב אם הפרויקט יגדל).

## Decision: Bootstrap אוטומטי ב-Terraform, לא ידני
`bootstrap/` הוא Terraform config נפרד עם **local state**, רץ פעם אחת בלבד,
יוצר את ה-GCS bucket שישמש כ-backend לכל שאר ה-infra + מפעיל APIs בסיסיים.
פותר את בעיית ה"ביצה ותרנגולת" (backend צריך bucket, ה-bucket צריך Terraform)
בלי לצאת מ-IaC.

## Decision: Cloud SQL דרך Auth Proxy, לא Private IP + VPC connector
חיבור מה-Backend (Compute Engine VM, ראו decision למטה) ל-Postgres דרך Cloud SQL
Auth Proxy — IP ציבורי אבל מוצפן mTLS ומאומת דרך IAM, לא DB "פתוח לעולם". פחות
רכיבי תשתית מ-Private IP (שדורש VPC peering מלא). מספיק מאובטח לסקאלה של הפרויקט.

## Decision: Workload Identity Federation ל-GitHub Actions
לא GCP service account JSON key כ-GitHub secret (anti-pattern — key ארוך-טווח
שיכול לדלוף). GitHub Actions מקבל token זמני דרך OIDC. מוקם כבר במודול ה-IAM
בשלב הזה, לפני שמגיעים ל-CI/CD בפועל, כדי לא לעשות refactor מאוחר יותר.

## Decision: Backend לא רץ על Cloud Run — Compute Engine, כמו ה-Broker
ה-Backend מחזיק MQTT subscription פתוח ורציף (decision #6, `architecture.md`) —
אותה סיבה בדיוק שפוסלת Cloud Run ל-Broker (scale-to-zero שובר חיבור מתמשך;
autoscaling לרוחב שובר state משותף) חלה גם עליו. שני הרכיבים רצים על
Compute Engine, כ-**שני VMs נפרדים** (לא VM משותף) — בידוד אמיתי בין broker
ל-backend, ותרגול Terraform מלא (module VM לכל אחד) על חשבון עלות נוספת זניחה
(עוד e2-micro אחד, ~$6-7/חודש).

## Decision: Mosquitto broker + Backend compute — נדחה לשלב edge/MQTT
המשאבים בשלב הזה: networking, Cloud SQL, Artifact Registry, IAM/WIF, Secret
Manager placeholders, billing budget. VM ל-broker ו-VM ל-backend יתווספו
(module Compute Engine per VM) כשמגיעים לשלב האינטגרציה עם המכשירים בפועל
(roadmap, `architecture.md`).

## משאבים בשלב הזה
- `google_project_service` — הפעלת APIs (sqladmin, artifactregistry, secretmanager...)
- VPC + subnet + firewall custom (לא default network)
- Cloud SQL instance (tier קטן) + database + user, גישה דרך Auth Proxy
- Artifact Registry repo (Docker)
- Secret Manager — secrets נוצרים כ-placeholders, ערכים מוזנים out-of-band
  (לא בtfvars שנכנס ל-git)
- IAM: service accounts ל-2 Compute Engine VMs (broker, backend — least privilege
  נפרד לכל אחד) + service account עם Workload Identity Federation ל-GitHub Actions
- `google_billing_budget` — התרעת תקציב
