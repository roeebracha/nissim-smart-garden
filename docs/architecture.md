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

### 8. בוט AI review אוטומטי ל-PRs — `anthropics/claude-code-action`, לא בוט custom
- **הקשר**: רוצים review אוטומטי על כל PR ב-Nissim (לא ידני כמו `/code-review
  ultra`). נבדק מול 12-factor ומול best practice של כלי review אמיתיים
  (CodeRabbit, Copilot review).
- **חלופה שנשקלה ונדחתה — בוט custom (v1 single-shot + v2 agent loop)**:
  תוכננה גרסה מדורגת (v1: קריאה בודדת ל-Claude על ה-diff, תגובה מרוכזת;
  v2 עתידי: agent loop עם tools read-only, inline comments — אותו pattern
  כמו decision #5) בהיקף ~150-800 שורות TS, בחבילה נפרדת מ-`backend/`. **נדחתה
  לאחר שהתברר שקיים `anthropics/claude-code-action@v1`** — action רשמי של
  Anthropic (מ-ספט' 2025) שמריץ את מלוא ה-runtime של Claude Code בתוך ה-runner
  (קריאת קבצים, git, shell) ותומך "out of the box" ב-automatic PR review
  (trigger על `pull_request`, checklist מותאם אישית, path-specific review).
- **החלטה**: משתמשים ב-`anthropics/claude-code-action@v1` הקיים. **0 קוד
  custom** — רק workflow yaml + GitHub App installation (`/install-github-app`
  מטרמינל Claude Code, דורש אישור אינטראקטיבי של המשתמש — לא ניתן לאוטומציה
  מלאה).
  - **Trigger**: GitHub Actions workflow על `pull_request` (opened/synchronize).
  - **Checklist מותאם אישית**: מוגדר בקונפיג ה-action — כולל התייחסות ל-12-factor
    ולעקרונות שכבר מתועדים ב-`architecture.md`/`git-workflow.md` (למשל
    separation of concerns בשכבות ה-AI, decision_source על actuator_events).
  - **Gate status**: **advisory בלבד** — לא required check (ראה `git-workflow.md`).
- **נימוק**: מול השיקול הלימודי (learning-approach.md) — הכתיבה של בוט custom
  לא הייתה מתרגלת "לוגיקת ליבה" של הפרויקט (כמו decision #5, שבו agent loop
  ידני משרת ישירות את שכבת ה-LLM המתוכננת), אלא היה מדובר בכלי-עזר סביבתי
  (tooling). **Trade-off מודע ושונה מ-decision #5**: שם דחינו framework כי
  הוא הסתיר בדיוק את המנגנון שרצינו לתרגל (agentic tool calling בליבת
  המערכת); כאן ה-action הקיים לא מסתיר שום דבר שתוכנן לתרגול — זה כלי CI
  צדדי, לא רכיב בארכיטקטורת האפליקציה. שימוש בכלי מוכן ומתוחזק ע"י Anthropic
  עדיף כאן על פני תחזוקת קוד custom ללא ערך לימודי תואם.
- **פירוט מלא של הוספה ל-PR checks**: ראה `git-workflow.md`.

### 9. DecisionModule: rule ו-ML הם אותו מסלול הערכה — ML מכייל thresholds, לא מחליט ישירות
- **הקשר**: decision #2 קבע ש"rules+ML יחד מריצים את הלולאה" אבל לא קבע את היחס
  בפועל בין השניים. עלה תוך כדי תכנון מפורט של ה-DecisionModule (roadmap #7):
  האם rule ו-ML הם שני evaluators נפרדים (עם conflict-resolution ביניהם), או
  מסלול אחד?
- **החלטה**: מסלול הערכה **אחד** — DecisionModule תמיד מעריך threshold rules
  (עם hysteresis: on/off thresholds נפרדים, לא סף בודד) מתוך `automation_rules`.
  ה-ML batch job (roadmap #8) רק **מעדכן את ה-thresholds בטבלה** לפי דאטה
  שנאסף — הוא **לא** מייצר החלטת actuator בעצמו. Cold start הוא פשוט
  "thresholds ברירת מחדל שטרם עודכנו ע"י ML", לא code path נפרד.
- **נימוק**: מסלול אחד = DecisionModule נבדק ב-unit tests בלי תלות בזמינות/מצב
  ML, ואין צורך בלוגיקת הכרעה בין שני evaluators שעלולים לסתור זה את זה.
- **השלכה על סכימה**: `automation_rules` צריך `onThreshold`/`offThreshold` +
  `operator` (במקום `thresholdValue` בודד — הפער כבר סומן בקומנט בסכמה) +
  שדה provenance (seed ידני מול עדכון ML, לביקורת). בפועל, `decision_source`
  על `actuator_events` תמיד יהיה `'rule'` תחת התכנון הזה — הערך `'ml'`
  ב-enum נשאר שמור לעתיד (מסלול ML-direct אם אי-פעם יתווסף), לא בשימוש כרגע.

### 10. חוזה MQTT ל-ingestion: topic + payload, מזהה sensor כשם לוגי לא כenum/PK
- **הקשר**: תכנון ה-Ingestion module (roadmap #4) דרש להחליט בין mock דרך REST זמני
  לבין MQTT אמיתי מיום 1 (Mosquitto כבר רץ ב-docker-compose), ולאחר מכן לקבוע
  את החוזה בפועל בין ה-firmware (עתידי, roadmap #5) לבקאנד.
- **החלטה**:
  - Mock דרך MQTT אמיתי, לא REST זמני — נמנעים מקוד ingestion כפול/זרוק כשה-firmware
    האמיתי יגיע, ובודקים בפועל את decision #1.
  - **Topic**: `nissim/<device_id>/readings` — כל חיישני ה-device עולים לtopic אחד;
    אין צורך בtopic נפרד לכל sensor כי ה-Ingestion מאזין לכל ה-device יחד.
  - **Payload**: `{ sensor, value, recorded_at }` — הודעה אחת per קריאה (בלי batching).
    `sensor` הוא **שם לוגי יציב** (למשל `"moisture_1"`), לא ה-id הפנימי של Postgres.
  - הבקאנד ממפה (`device_id` + `sensor`) → שורה ב-`sensors` דרך `Sensor.name` הקיים
    בסכימה, ומאמת את המיפוי בזמן ingestion (דוחה שמות לא מוכרים) — לא enum.
- **נימוק**: נשקל enum משותף ל-payload ולבקאנד, ונדחה — enum מתאים לאוצר מילים
  סגור ברמת קוד (כמו `DecisionSource`/`ThresholdOperator`), לא לישויות דאטה
  שאמורות להיות ניתנות להגדרה ב-DB (אותו עיקרון כמו decision #9). enum על זהות
  sensor דורש קוד+migration+redeploy כדי להוסיף חיישן — סותר את הסיבה שיש בכלל
  טבלת `sensors`. גם אין רווח type-safety אמיתי בין הצדדים — ה-firmware (C++)
  לא יכול לשתף enum של TypeScript ממילא, ה-payload הוא JSON חוצה-שפות שתמיד
  דורש ולידציה בזמן ריצה. ולידציה מול `Sensor.name` נותנת את אותה הגנה מפני
  typo/mismatch בלי לקשח מופעים ספציפיים בקוד.

### 11. Ingestion → Decision Engine: קריאה ישירה (DI), לא event emitter
- **הקשר**: decision #6 קבע שה-trigger הוא reactive — כל `sensor_readings` INSERT
  מפעיל את בדיקת ה-decision "באותו handler" — אבל לא קבע את מנגנון החיבור בקוד
  בין IngestionModule ל-DecisionModule.
- **החלטה**: קריאה ישירה — `IngestionService` מזריק (DI) את `DecisionService`
  וקורא לו ישירות (`await`) אחרי שמירת ה-reading. לא `@nestjs/event-emitter`.
- **נימוק**: יש כרגע צרכן יחיד ל"קריאה חדשה נכנסה" (Decision Engine) — היתרון
  המרכזי של event emitter (fan-out מנותק למספר צרכנים) לא רלוונטי עדיין.
  זו לולאת ההחלטה האוטומטית הליבה של מערכת safety-critical (decision #2) —
  ב-`EventEmitter2` חריגה בתוך listener לא חוזרת כברירת מחדל ל-emitter, כך
  שבאג בהערכה עלול "להיבלע" בשקט; קריאה ישירה + `await` הופכת כשל לגלוי
  ומתועד. גם שומרת על העיקרון מ-decision #5 — לחשוף את הזרימה בקוד, לא להסתיר
  אותה מאחורי indirection. אם יעלה צרכן שני עצמאי בעתיד (למשל push ל-dashboard
  ב-WebSocket), זו הנקודה לשקול event emitter מחדש — לא כרגע.

### 12. DecisionModule מעריך hysteresis מול desiredState, לא reportedState
- **הקשר**: להערכת hysteresis (decision #9) נדרש לדעת את "המצב הנוכחי" של
  ה-actuator כדי להחליט מול איזה סף (on/off) להשוות את הקריאה החדשה.
- **החלטה**: DecisionModule קורא את `Actuator.desiredState` (לא `reportedState`).
- **נימוק**: מונע כפילות/התנגשות פקודות — `reportedState` מפגר טבעית אחרי
  `desiredState` (ack latency), אז קריאה מולו הייתה גורמת ל-Decision Engine
  "לשכוח" שכבר שלח פקודה ולשלוח פקודה כפולה בזמן שהראשונה עדיין ב-flight.
  הפער בין desired/reported (decision #6) הוא concern נפרד לגמרי — execution
  integrity על ציר זמן שונה (scheduled watchdog, טרם ממומש), לא consistency
  של intent על כל קריאה בודדת (Decision Engine, reactive). לערבב את השניים
  היה גורם ל-false positive על כל פקודה שנשלחת (latency רגיל = "תקלה").

### 13. automation_rules: unique constraint על (planterId, sensorType, actuatorType)
- **הקשר**: DecisionService צריך למצוא את ה-rule המתאים לכל reading לפי
  planterId+sensorType — אין FK אמיתי בין sensors/actuators ל-automation_rules
  (הם מותאמים כ-string matching). עלה חשש: מה מונע משני rules סותרים על
  **אותו actuator בדיוק**?
- **החלטה**: unique constraint ברמת ה-DB על `(planterId, sensorType, actuatorType)`
  — לא רק בדיקה באפליקציה. rules עם אותו `sensorType` אך `actuatorType` שונה
  (למשל טמפ'→מאוורר וגם טמפ'→מיסטור) מותרים ותקינים לגמרי; DecisionService
  מעריך כל rule תואם בנפרד, כל אחד מול ה-actuator שלו.
- **נימוק**: אכיפת invariant בשכבת ה-DB (לא רק בקוד השירות) מגנה גם מפני seed
  שגוי או עריכה ידנית ב-DB, לא רק מבאג בלוגיקת האפליקציה. נשקלה גם אלטרנטיבה
  גדולה יותר — להחליף את `sensorType`/`actuatorType` (strings) ב-FK אמיתי
  (`sensorId`/`actuatorId`) — ונדחתה לעת עתה: FK מבטל typos/drift אך פוגע
  ביכולת להחליף חיישן/actuator פיזי בלי לעדכן את ה-rule (string matching
  "עובד אוטומטית" עם חומרה חדשה מאותו סוג/אדנית). נשאר known trade-off, לא
  נסגר סופית.

### 14. PrismaService משותף כ-`@Global()` module, לא import מפורש בכל מודול
- **הקשר**: כמעט כל מודול עתידי (Decision, Ingestion, API, Operation, ML,
  LLM) צריך גישה ל-Postgres דרך Prisma. צריך להחליט בין instance משותף
  אחד (registered פעם אחת) לבין `imports: [PrismaModule]` חוזר בכל מודול
  שצריך DB.
- **החלטה**: `PrismaService` (`class PrismaService extends PrismaClient`,
  `OnModuleInit` → `$connect()` מפורש בעלייה, `OnModuleDestroy`/shutdown
  hook לסגירה מסודרת) עטוף ב-`PrismaModule` עם `@Global()`, נרשם פעם אחת
  ב-`AppModule`. חי תחת `backend/src/prisma/`.
- **נימוק**: `@Global()` הוא escape hatch מודע ב-NestJS, לא ברירת מחדל —
  מוצדק כאן כי DB access נדרש כמעט בכל מודול (בניגוד ל-provider ספציפי
  לפיצ'ר אחד), אותו pattern מקובל ל-infra services יחידים (DB, logging,
  config). מונע חזרה על `imports: [PrismaModule]` בכל מודול פיצ'ר חדש.

### 15. `Actuator.desiredState`/`reportedState`: `String` → `enum`
- **הקשר**: תוך כדי תכנון `evaluate()` (roadmap #7): `evaluateHysteresis`
  מצפה ל-`currentState: 'on' | 'off'` (union מדויק), אבל בסכימה השדות
  מוגדרים `String` רגיל — פער טיפוסים בין הקוד לסכימה.
- **החלטה**: הופכים את `desiredState`/`reportedState` ל-`enum` (למשל
  `ActuatorState { on off }`), באותו pattern כמו `ThresholdOperator`/
  `DecisionSource`/`ThresholdSource` הקיימים בסכימה.
- **נימוק**: עקרון כללי מקובל — קבוצת ערכים סגורה וידועה מראש (on/off של
  ממסר פיזי) אמורה להיות type, לא string חופשי ("illegal states
  unrepresentable"). זה תואם ישירות את ההבחנה שכבר נקבעה ב-decision #10:
  enum לאוצר מילים סגור ברמת קוד, `String` לנתונים שאמורים להיות ניתנים
  להגדרה ב-DB (`Sensor.type`/`Actuator.type` **נשארים** `String` — סוג
  החיישן/actuator הוא בדיוק המקרה שכן צריך גמישות, decision #10 — לא
  מושפע מההחלטה הזו). **Caveat ידוע**: native enum ב-Postgres קשה לשנות
  (הוספת ערך מוגבלת, הסרה/שינוי סדר כמעט בלתי אפשריים) — לא רלוונטי כאן כי
  on/off הוא מצב בינארי יציב של ממסר פיזי, לא טקסונומיה שצפויה לגדול; גם
  הסכימה כבר מקבלת את אותו סיכון במקומות אחרים. תמיכה עתידית ב-actuator
  שאינו בינארי (dimmer) **לא מתוכננת כרגע** — over-engineering מוקדם לפי
  אותו היגיון כמו decision #3, ותיפתר במידה ותידרש דרך migration נקודתי או
  שדה נפרד לאותו actuator ספציפי, לא מתיחת ה-enum המשותף.

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
