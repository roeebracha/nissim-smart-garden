# Nissim — Smart Garden IoT System

מסמך חי המתעד את הארכיטקטורה וההחלטות שלנו לאורך הפרויקט. השם על שם הגנן מבית הספר.

**עקרון-על לפרויקט**: כל החלטה נבדקת מול best practice מקובל בתעשייה, לא רק "מה שעובד".
כשיש כמה אפשרויות תקינות — נבחר לפי מה שהכי קרוב לאיך שבונים את זה בפועל בעולם האמיתי,
גם אם זה דורש יותר עבודה מהפתרון הכי קצר.

לחלוקת תפקידים ולגישת הלמידה של הפרויקט (מי כותב מה, ולמה) ראו
[`docs/learning-approach.md`](./learning-approach.md). למדיניות Git/PR/deployment
ראו [`docs/git-workflow.md`](./git-workflow.md). למבנה ה-Terraform/GCP ראו
[`docs/infra-terraform.md`](./infra-terraform.md).

## מטרת המערכת
שתי אדניות (צמח תה, פלפלים קטנים) עם חיישני לחות/אור/טמפ' וכן פומפת מים/תאורה.
המערכת קוראת נתונים, מקבלת החלטות אוטומציה (השקיה/תאורה), ומאפשרת מעקב ושליטה
דרך אפליקציית web. שכבת AI (ML + LLM) מוסיפה אופטימיזציה והסבר.

## תמונה כללית — שכבות

```
[Edge: ESP32 x1 (משותף לשתי האדניות — מרפסת, קרובות זו לזו), חיישנים + ממסר לפומפה/תאורה כפול]
        │  MQTT (publish readings / subscribe commands)
        ▼
[Broker: Mosquitto — container, self-hosted]
        │
        ▼
[Backend: Ingestion + API + Decision Engine (rules+ML, אוטומטי) + LLM module (on-demand)]
        │
        ▼
[Postgres — planters, sensors, readings, actuator_events, automation_rules]
        ▲
        │  REST API
[Frontend: דשבורד סטטוס + שליטה ידנית + קונפיג]
```

כל הרכיבים ב-Docker, מוקמים ב-Terraform ל-GCP, עם CI/CD דרך GitHub Actions.

## החלטות (decision log — ADR-lite)

### 1. MQTT ולא HTTP polling לתקשורת עם המכשירים
- **הקשר**: מכשירי ה-ESP32 יושבים מאחורי NAT, אין להם IP ציבורי. השרת לא יכול
  "לדחוף" אליהם ב-HTTP רגיל.
- **החלטה**: MQTT עם Mosquitto self-hosted (Cloud IoT Core של גוגל deprecated מ-2023).
- **נימוקים**: latency נמוך לפקודות אקטואטור (חיבור TCP פתוח, לא polling interval),
  Last Will Testament לזיהוי מכשיר אופליין, retained messages לסטטוס מיידי ל-dashboard
  חדש, decoupling בין publisher ל-subscribers.

### 2. הפרדת שכבות AI: דטרמיניזם+ML מריצים את הלולאה האוטומטית, LLM רק on-demand
- **הקשר**: בקרה על אקטואטור פיזי (פומפה) היא safety-critical. LLM לא דטרמיניסטי,
  איטי, יקר, ותלוי בזמינות API חיצוני — לא מתאים כמקבל החלטה אוטומטית וחוזרת.
  שיקולי בטיחות ושיקולי עלות/אמינות מובילים לאותה מסקנה בפועל, משני כיווני חשיבה
  שונים — סימן חזק שזו הבחירה הנכונה.
- **החלטה**: שלוש שכבות, עם קו הפרדה ברור — **LLM לא משתתף בלולאת ההחלטה
  האוטומטית בכלל**:
  1. **Safety layer** (hardcoded) — כללים קשיחים הנאכפים ב-Operation module ברגע
     ההפעלה הפיזית עצמה, ללא תלות במקור ההחלטה (לא רק "תקרה" על החלטה של שכבה
     אחרת) — למשל מקסימום זמן פתיחת פומפה, מינימום מרווח בין השקיות.
  2. **ML קלאסי** (נלמד מדאטה, אך דטרמיניסטי — אותו קלט תמיד מייצר אותו פלט עד
     אימון מחדש) — heuristic/סף בהתחלה (cold start — אין דאטה ביום הראשון),
     regression פשוט על הדאטה שנאסף בהמשך. **rules+ML יחד מריצים את כל לולאת
     ההחלטה השגרתית** — המערכת ממשיכה לפעול גם אם ה-LLM API לא זמין בכלל.
  3. **LLM** — **רק on-demand**: תגובה לשאלת משתמש (צ'אט) או משימה מתוזמנת ליצירת
     תוכן הסברי (סיכום יומי) — לעולם לא כחלק מלולאת ההחלטה על אקטואטור. עובד
     כ-agent עם tool calling מרובה-סבבים (לולאה ידנית מול Claude API, החלטה #5):
     המודל בוחר בעצמו אילו tools לקרוא לפי השאלה, לא מקבל דאטה שנדחף מראש. הצעות
     לשינוי `automation_rules` נכתבות ל-suggestions table נפרדת (`status=pending`) —
     דורשות אישור אדם מפורש (endpoint API רגיל, לא חלק מריצת ה-agent) לפני שנכנסות
     לתוקף בפועל ב-`automation_rules` — לא auto-apply.
- **דרישות תפעוליות נגזרות מה-agentic tool calling**:
  - **Iteration cap** על ה-agent loop (`max_tool_calls`) — הגנה תפעולית מפני
    עלות/latency בלתי מבוקרים, בנוסף (לא במקום) לבטיחות הפיזית.
  - כל tool הוא query מוגדר ומוגבל (למשל `get_recent_readings(planter_id, days)`
    עם תקרת טווח) — לא גישת SQL פתוחה, כדי לא להציף context ולשמור גבול ברור.
  - trace logging מלא של רצף קריאות ה-tools (לא רק הפלט הסופי) — נדרש להסבר
    ולדיבוג בדיעבד.
- **נימוק רחב**: זה ה-pattern שבו בונים מערכות agentic רציניות בתעשייה —
  דטרמיניזם+ML לבקרה אוטומטית אמינה, LLM לממשק והבנה על-פי דרישה. עיקרון זה
  יונחל על כל שאר ההחלטות בפרויקט, לא רק כאן.

### 3. Postgres רגיל, לא TimescaleDB
- **הקשר**: טבלת sensor_readings היא high-volume (time-series).
- **החלטה**: Postgres רגיל עם אינדקס מורכב `(sensor_id, received_at DESC)`.
- **נימוק**: בסקאלה של 2 אדניות (~9K שורות/יום), Postgres מספיק לגמרי.
  TimescaleDB זה over-engineering כרגע — שווה לדעת שקיים, לא להשתמש עדיין.

### 4. Node.js/TypeScript + NestJS + Prisma, לא Python/FastAPI
- **הקשר**: שינוי מהחלטה קודמת (Python/FastAPI/SQLAlchemy). המטרה הלימודית המרכזית
  של הפרויקט היא לתרגל כתיבת קוד — ורוב הזמן בפועל נכתב ב-backend, לכן עדיף שהוא
  יהיה בשפה שרוצים לתרגל בה (JS/TS), ולא בשפה שכבר יש בה ניסיון קודם.
- **החלטה**: NestJS (structured framework, dependency injection — המקביל הפילוסופי
  הכי קרוב ל-FastAPI) + Prisma (schema+migrations) לשכבת הגישה ל-Postgres.
- **נימוק**: זה stack סטנדרטי לגמרי בתעשייה ל-Node+Postgres, לא בחירה אקזוטית.
  Prisma מייצר migrations קריאות (`prisma migrate dev`) שאפשר לקרוא ולהבין, ו-typed
  client שמונע שגיאות טיפוס. חשוב לעבוד בהתחלה בסגנון מפורש (query מפורש) כדי
  שתמיד יהיה ברור אילו שאילתות באמת רצות ב-DB.

### 5. Agent loop ידני מול Claude API, לא Google ADK — מבודד למודול/שירות נפרד
- **הקשר**: יש ניסיון קודם עם Google ADK בעבודה — אבל בדיוק בגלל זה, שימוש בו כאן
  לא מוסיף ערך לימודי. ADK גם Python/Java בלבד, לא תואם למעבר ה-backend ל-Node/TS
  (החלטה #4). מטרת הפרויקט היא להבין את מנגנון ה-agentic tool calling "מבפנים",
  לא רק לחבר framework שמסתיר אותו.
- **החלטה**: מימוש ידני של הלולאה מול Claude Messages API (`tools` param, בדיקת
  `stop_reason`, הרצת tool בקוד, הזנת `tool_result` בחזרה, `max_tool_calls` cap) —
  בתוך מודול/שירות ה-LLM (insights/chat) בלבד, לא מעורב בבקאנד הליבה (ingestion,
  API, safety layer, decision engine).
- **נימוק**: שומר על העיקרון מהחלטה #2 — ה-agent מקבל **רק** כלים לקריאה או
  להצעה (כתיבה ל-suggestions table), לעולם לא כלי שמפעיל אקטואטור ישירות. כתיבת
  הלולאה בעצמך חושפת את כל המנגנון (message history, זיהוי tool_use, trace
  logging) במקום שיוסתר בתוך אבסטרקציה — משרת ישירות את מטרת הלמידה. framework
  agentic (למשל LangGraph.js) נשאר אופציה עתידית אם תידרש אורקסטרציה מורכבת יותר
  (state מרובה-צמתים, checkpointing אמיתי) — לא נדרש כרגע, כי אישור ההצעה האנושי
  הוא endpoint API רגיל ולא interrupt בתוך ריצת ה-agent.

### 6. מנגנון ה-flow השגרתי: trigger, גבולות manual override, ו-desired/reported state
- **הקשר**: לאחר עיצוב שכבות ה-AI (decision #2), נדרש לקבוע גם את מנגנון ההפעלה
  בפועל: מתי הלולאה רצה, מה קורה בהשקיה ידנית, ואיך יודעים שפקודה בוצעה בפועל
  (לא רק שנשלחה).
- **החלטה**:
  - **Trigger**: reactive/event-driven — כל `sensor_readings` INSERT מפעיל מיידית
    את בדיקת ה-decision (rule/ML) על אותו reading, בתוך אותו handler. ה-ML batch
    job (עדכון סף) וה-watchdog (זיהוי מכשיר שקט) הם **scheduled** — שניהם דורשים
    חלון זמן, לא אירוע בודד.
  - **Manual override**: עוקף רק את **שכבת ההחלטה** (rule/ML) — לא את ה-hard caps
    הפיזיים (decision #2, שכבה 1), שנשארים בתוקף גם על פעולה ידנית.
  - **Desired vs reported state**: `actuators` מחזיק שני שדות נפרדים —
    `desired_state`/`desired_since` (מתעדכן כשנשלחה פקודה) ו-
    `reported_state`/`reported_at` (מתעדכן רק כש-ESP32 שולח ack בפועל). פער
    ממושך בין השניים = סימן לתקלה, קלט אפשרי ל-watchdog.
- **נימוק**: ה-trigger מנצל את זה ש-MQTT כבר event-based מטבעו — אין סיבה
  להוסיף polling מיותר. גבול ה-manual override שומר על העיקרון "guardrail
  תמיד חל, בלי תלות במקור" (decision #2) תוך כיבוד מטרת ה-override עצמה (לעקוף
  החלטה, לא הגנה פיזית). desired/reported state סוגר את הפער בין "שלחתי פקודה"
  ל"המכשיר באמת ביצע" — נדרש כי ESP32 מאחורי NAT ופקודה יכולה פשוט לא להגיע.

### 7. ESP32 אחד משותף לשתי האדניות, לא בקר-לכל-אדנית
- **הקשר**: שתי האדניות במרפסת, קרובות פיזית זו לזו — אורך כבל אנלוגי לחיישן
  הלחות (הסיכון המרכזי לבקר משותף) לא רלוונטי במרחק כזה.
- **החלטה**: בקר ESP32 אחד, עם זוג חיישנים/ממסרים לכל אדנית (GPIO נפרדים).
- **נימוק**: חוסך עלות ומורכבות רשת/קוד בלי הסיכון המעשי (רעש בכבל אנלוגי
  ארוך) שדחה את זה במקרה הכללי. **Trade-off מקובל ומודע**: single point of
  failure — נפילת ה-ESP32 מנתקת טלמטריה/שליטה משתי האדניות בו-זמנית, לא רק אחת.
- **השלכה על סכימת ה-DB**: `devices` כבר לא מקושר ל-`planter_id` בודד (חומרה
  פיזית גרידא). `planter_id` עובר להיות שדה על `sensors`/`actuators` עצמם —
  כל חיישן/אקטואטור בודד שייך לאדנית ספציפית, גם אם הם חולקים אותו device.

### 8. בוט AI review אוטומטי ל-PRs — GitHub Actions, agent loop, advisory בלבד
- **הקשר**: רוצים review אוטומטי על כל PR ב-Nissim (לא ידני כמו `/code-review
  ultra`). נבדק מול 12-factor ומול best practice של כלי review אמיתיים
  (CodeRabbit, Copilot review).
- **החלטה**:
  - **Trigger**: GitHub Actions workflow על `pull_request` — לא GitHub App/webhook
    (אין endpoint ציבורי להחזיק) ולא polling (לא event-driven).
  - **LLM call pattern**: agent loop ידני מול Claude API עם tools **read-only**
    (`get_file`, `get_diff`, `list_changed_files`) — לא single-shot prompt על
    ה-diff בלבד. אותו pattern בדיוק כמו decision #5 (agent loop ידני, לא
    framework), עם `max_tool_calls` cap ו-trace logging מלא כמו שם.
  - **פרסום**: Pull Request Review API עם inline comments מעוגנים לשורה — לא
    תגובה בודדת (issue comment).
  - **Auth**: `GITHUB_TOKEN` המובנה של ה-Action (repo-scoped) — מספיק כי הבוט
    משרת את Nissim בלבד, לא כלי multi-repo (לא נדרש GitHub App/installation token).
  - **מיקום קוד**: חבילה נפרדת (למשל `tools/pr-review-bot/`), לא בתוך
    `backend/` (NestJS) — dependency graph שונה לגמרי (אין DB/Prisma, רק
    GitHub API client + Claude SDK).
  - **Gate status**: **advisory בלבד** — לא required check. עקבי עם ה-ADR
    ב-`git-workflow.md` שקובע gate = required checks בלבד (ראה שם); AI review
    לא אמור לחסום merge בפרויקט סולו.
- **נימוק על 12-factor**: 12-factor נכתב לשירות חי (port binding, process
  model) — בוט שרץ כ-job חד-פעמי ב-Actions הוא סקריפט, לא שירות, ורוב
  ה-factors לא רלוונטיים (מתקיימים אוטומטית כי Actions job הוא disposable
  מטבעו). מה שכן תופס בפועל ומכתיב את ההחלטות למעלה: Factor I (codebase נפרד
  לכל app — קוד הבוט לא נכנס ל-NestJS), Factor II (dependencies מפורשים —
  `package.json` עצמאי), Factor III (config דרך env/GitHub Secrets, לא
  hardcoded), Factor XI (logs כ-stdout stream — Actions תופס אוטומטית).
- **פירוט מלא של ה-workflow ותוספת ל-PR checks**: ראה `git-workflow.md`.

## סכימת DB — קונספט (טרם ממומש)

| טבלה | תפקיד |
|---|---|
| `planters` | ישות לוגית יציבה (שם, סוג צמח) |
| `devices` | חומרה פיזית גרידא (לא מקושרת לplanter ישירות — decision #7), `last_seen_at` |
| `sensors` | per device, עם `planter_id` משלו (חיישן בודד שייך לאדנית ספציפית) |
| `sensor_readings` | time-series: value, `recorded_at` (שעון מכשיר), `received_at` (שעון שרת) |
| `actuators` | per device, עם `planter_id` משלו; `desired_state`/`desired_since` + `reported_state`/`reported_at` (decision #6) |
| `actuator_events` | audit trail: מתי הופעל, `decision_source` (manual/rule/ml — LLM אף פעם לא מקור ישיר) |
| `automation_rules` | כללי סף/safety כנתונים, לא קוד מקושח |
| `llm_insights` | סיכומים/תשובות צ'אט |

נקודת עיצוב מרכזית: `decision_source` על כל actuator_event — כדי שתמיד אפשר יהיה
להסביר "למה הפומפה נדלקה", וכדי לשמור על ההפרדה בין שכבות ה-AI גם ברמת הדאטה.

## Roadmap / סדר בנייה — טיוטה, בדיון

1. שלד repo + Docker Compose לסביבה מקומית (Postgres + Mosquitto + backend stub)
2. Terraform — תשתית GCP בסיסית (Cloud SQL, networking, Artifact Registry)
3. CI/CD — GitHub Actions (build/test/push images, terraform plan/apply)
4. Backend skeleton — API + DB migrations + ingestion endpoint (מכשיר וירטואלי/mock)
5. Edge — firmware skeleton (ESP32), חיבור MQTT אמיתי
6. Frontend skeleton — דשבורד קורא מה-API
7. Safety/automation rules layer
8. ML layer
9. LLM layer (insights + chat + function calling, agent loop ידני מול Claude API — כלים read-only/הצעה בלבד)
10. (אופציונלי) RAG — knowledge base של טיפול בצמחים

## כלים וטכנולוגיות — בדיון, ראה שיחה
Docker, Terraform, GCP, GitHub Actions, Node.js/TypeScript + NestJS + Prisma +
Postgres (backend), Next.js (frontend), MQTT, ML (סטטיסטי, JS), Claude API
(LLM — agent loop ידני), RAG (בבדיקה — ראה דיון).
