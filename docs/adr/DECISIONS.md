# Architecture decisions

Single log of architecture decisions, newest first. Numbers **1–20** are the original numbers in [`docs/architecture.md`](../architecture.md).

**21, 22, and 23** had no number in the repo. They are follow-ups from pull-request reviews. The numbers are the next integers, in the order the reviews raised them: 21 on 2026-09-13, then 22 and 23 on 2026-10-07. They were first recorded here as **Proposed**. Roee accepted them in chat on 16 Oct 2026. The date on each of those rows is the acceptance date, 2026-10-16. The original review date stays in the row.

**24** is the frontend choice. It is not a numbered decision in `docs/architecture.md`. Roee approved it in chat on 16 Oct 2026.

Dates are the author date of the commit that recorded the decision, unless a row says otherwise. Status is only **Accepted** or **Proposed**. Decision 8 was later undone by decision 17; both stay Accepted, and 17’s consequences say the workflow is gone.

Infrastructure choices in [`docs/infra-terraform.md`](../infra-terraform.md) were never numbered. They are at the bottom, under the same headings, without invented numbers.

## Index

| Number | Date | Status | Title |
|---|---|---|---|
| 24 | 2026-10-16 | Accepted | Frontend chosen as React + shadcn/ui |
| 23 | 2026-10-16 | Accepted | Run the 03:00 calibration cron in Asia/Jerusalem |
| 22 | 2026-10-16 | Accepted | Nightly calibration never narrows the on/off band |
| 21 | 2026-10-16 | Accepted | Re-arm the pump max-on timer on startup and clear it on destroy |
| 20 | 2026-09-16 | Accepted | ML batch calibrates thresholds inside the backend and never actuates |
| 19 | 2026-09-12 | Accepted | Thin Operation, and one MQTT client for subscribe and publish |
| 18 | 2026-09-12 | Accepted | Build the backend / AI / infra spine; edge stays optional |
| 17 | 2026-09-10 | Accepted | Remove the Claude PR-review workflow |
| 16 | 2026-09-06 | Accepted | MQTT client is mqtt.js |
| — | 2026-09-03 | Accepted | Environment roots are named dev and prod |
| 15 | 2026-09-03 | Accepted | `desiredState` / `reportedState` are an enum |
| 14 | 2026-09-03 | Accepted | Prisma is one global module |
| 13 | 2026-09-03 | Accepted | Unique `(planterId, sensorType, actuatorType)` on rules |
| 12 | 2026-09-03 | Accepted | Hysteresis reads `desiredState` |
| 11 | 2026-09-03 | Accepted | Ingestion calls Decision directly |
| 10 | 2026-09-03 | Accepted | MQTT ingestion contract: topic, payload, logical sensor name |
| 9 | 2026-08-19 | Accepted | One evaluation path; ML calibrates thresholds |
| 8 | 2026-08-15 | Accepted | PR review via `anthropics/claude-code-action` (removed by 17) |
| 7 | 2026-08-15 | Accepted | One ESP32 for both planters |
| 6 | 2026-08-15 | Accepted | Reactive trigger, manual override, desired vs reported |
| 5 | 2026-08-15 | Accepted | Hand-written Claude tool loop, inside the LLM module |
| 4 | 2026-08-15 | Accepted | NestJS and Prisma |
| 3 | 2026-08-15 | Accepted | Plain Postgres |
| 2 | 2026-08-15 | Accepted | Safety and rules/ML run the loop; LLM is on demand |
| 1 | 2026-08-15 | Accepted | MQTT with self-hosted Mosquitto |
| — | 2026-08-15 | Accepted | Infrastructure decisions with no number (see end) |

## 24. Frontend chosen as React + shadcn/ui

- **Number:** 24
- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Decision 18 left the frontend optional (item 6 in this log’s remaining order; step 4 of the remaining list in [`docs/architecture.md`](../architecture.md)). The tools section of that doc lists Next.js as under discussion, not as a numbered decision. Roee required a very simple dashboard tonight.
- **Options:**
  - Next.js.
  - Vite + React + TypeScript + shadcn/ui.
- **Decision:** Vite + React + TypeScript + shadcn/ui, in `frontend/`, after the backend in decision 18’s order.
- **Consequences:** PR 9 builds it. The approve button calls PR 5’s route (`POST /suggestions/:id/approve`). No Next.js app.
- **Source:** Approved by Roee in chat on 16 Oct 2026.

## 23. Run the 03:00 calibration cron in Asia/Jerusalem

- **Number:** 23
- **Date:** 2026-10-16 (accepted; proposed on 2026-10-07)
- **Status:** Accepted
- **Context:** Review of PR #10 (implemented calibration, commit `6065ff7`) on 2026-10-07. `@Cron` uses the process clock. The review says the backend container is probably UTC, so “3AM” would be 06:00 in Israel. It cites 12-factor: behavior comes from config, not from the host. Decision 20 already names a nightly 03:00 cron and does not name a timezone. The merged decorator is `@Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'ml-recalibrate' })` with no `timeZone`.
- **Options:**
  - Leave `EVERY_DAY_AT_3AM` on the process timezone (what merged).
  - Set `timeZone: 'Asia/Jerusalem'` on that cron. The review gives this as the fix.
- **Decision:** Run the 03:00 cron in `Asia/Jerusalem`. Accepted on 2026-10-16. PR #10 merged on 2026-10-08 without the option; this entry records acceptance, and the code change is a separate pull request.
- **Consequences:** Until this is implemented, the job follows the container clock. The review’s sketch is `timeZone: 'Asia/Jerusalem'` on the existing `EVERY_DAY_AT_3AM` cron named `ml-recalibrate`.
- **Source:** Accepted from Roee’s overnight instruction in chat on 16 Oct 2026. Originally proposed in the PR #10 review comment on `backend/src/ml/ml.service.ts`, 2026-10-07. https://github.com/roeebracha/nissim-smart-garden/pull/10

## 22. Nightly calibration never narrows the on/off band

- **Number:** 22
- **Date:** 2026-10-16 (accepted; proposed on 2026-10-07)
- **Status:** Accepted
- **Context:** Same PR #10 review, same day, marked “worth deciding before merge.” Readings come from a garden that is already following the rule, so the 20th and 80th percentiles sit inside the current on/off band. Each night the band gets tighter until `MIN_GAP` (5). A 5-point band turns the pump on and off much more often, which is what hysteresis was there to prevent. The merged job still writes percentiles after the step cap, domain clamp, and gap repair, and it has no width guard.
- **Options:**
  - Keep the current write path (step, domain, gap).
  - Never let a run make the band narrower than it is today. The review’s sketch shifts the band around the center of the new percentiles and sets width to `max(high - low, currentWidth)` before `deriveThresholds`.
  - A per-sensor minimum band, named in the same comment as another possible guard.
- **Decision:** Add a guard so nightly calibration never narrows the on/off band. Accepted on 2026-10-16. The pull request merged the next day without it; this entry records acceptance, and the code change is a separate pull request.
- **Consequences:** Closed-loop percentiles can shrink the band down to the minimum gap and short-cycle the pump until the guard lands. The review asks for a test that runs `recalibrateRule` several times on readings spread evenly between the current on and off thresholds.
- **Source:** Accepted from Roee’s overnight instruction in chat on 16 Oct 2026. Originally proposed in the PR #10 review comment on `backend/src/ml/ml.service.ts`, 2026-10-07. https://github.com/roeebracha/nissim-smart-garden/pull/10

## 21. Re-arm the pump max-on timer on startup and clear it on destroy

- **Number:** 21
- **Date:** 2026-10-16 (accepted; proposed on 2026-09-13)
- **Status:** Accepted
- **Context:** Educational reviews on PR #8 (2026-09-13), repeated on PR #9 after it merged, and still listed as an open should-fix on `main` in the PR #10 review (2026-09-16). `safetyTimers` is a `Map` in `OperationService`. `MAX_ON_MS` is 5000. After a restart (deploy, crash, or `docker compose restart`), Postgres can still say `desiredState` is `on` while the map is empty. Decision does not call Operation again while the rule still wants `on`, so nothing schedules the force-off. The check on the way in almost never runs for Decision, because Decision only calls when `nextState` differs from `desiredState`. The timer is the real max-on path for rules.
- **Options:**
  - Keep timers in process memory only (what PR #9 merged).
  - On startup (`OnModuleInit`), load actuators whose `desiredState` is `on`. If `desiredSince` is already at least `MAX_ON_MS` ago, force `off` through the same door. Otherwise schedule the remaining time (`MAX_ON_MS - elapsed`). The PR #9 sketch uses `Math.max(0, MAX_ON_MS - elapsed)` and says to run the overdue case immediately.
  - On shutdown (`OnModuleDestroy`), clear every timer in the map so a timeout does not run after Nest has torn the providers down.
  The review treats boot re-arm and destroy-clear as one fix. A separate soft note, not this proposal, suggested a future `DecisionSource` value `safety` for the force-off audit row. The sketches pass `'rule'`.
- **Decision:** Re-arm the pump max-on timer on startup (`OnModuleInit`) from `desiredState` / `desiredSince`, and clear timers on destroy. Accepted on 2026-10-16. `OperationService` on `main` still has neither hook; this entry records acceptance, and the code change is a separate pull request.
- **Consequences:** Until this lands in code, a restart can leave the pump desired-on with no force-off, and a timeout can fire into a destroyed Nest context. [`AGENTS.md`](../../AGENTS.md) states timer survival as a safety rule.
- **Source:** Accepted from Roee’s overnight instruction in chat on 16 Oct 2026. Originally proposed in the PR #8 and PR #9 reviews, `backend/src/operation/operation.service.ts`, 2026-09-13. https://github.com/roeebracha/nissim-smart-garden/pull/9

## 20. ML batch calibrates thresholds inside the backend and never actuates

- **Number:** 20
- **Date:** 2026-09-16 (discussion dated 2026-09-13 in `learning-notes/architecture-learning-log.md`; decision text committed that day on the PR branch; squash-merged to `main` on 2026-10-08)
- **Status:** Accepted
- **Context:** Decision 9 said ML only updates thresholds in `automation_rules`. Still open: where the job runs, which v1 algorithm, and what it must not touch. The learning log weighs module versus container versus microservice, and supervised versus unsupervised families.
- **Options:**
  - Placement: a Nest module and cron in the backend process; a second Compose worker with the same code; an ML microservice with its own deploy and network contract.
  - Algorithm: a live model that emits on/off on every reading; regression that predicts a future moisture value; unsupervised percentiles over a window of days.
- **Decision:**
  - `MlModule` runs in the same backend process and container, on a cron via `@nestjs/schedule`. It is not a fourth Compose service and not a microservice. Ingestion, Decision, and Operation do not import ML.
  - v1 is unsupervised percentiles of the last 7 days of readings for each active rule (`planterId` + `sensorType`). No ML library. The decision text also says the job does not use `actuator_events`, light/temperature, or regression.
  - If the sample count is below `MIN_SAMPLES`, write nothing. Cold start keeps the seed. Guessing on empty data is worse than the seed.
  - Write `onThreshold` / `offThreshold` and `updatedBy: ml`. Force hysteresis order for the operator, a minimum gap, a clamp to a safe range for the sensor type, and a maximum step from the current values.
  - Forbidden: calling `requestActuation` or injecting Operation. `decision_source` on events stays `'rule'`.
  - Recommended defaults, tunable and not schema: `WINDOW_DAYS=7`, `MIN_SAMPLES=50`, `MIN_GAP=5`, max step about 10 sensor units, nightly cron at 03:00. Cuts at the 0.2 and 0.8 percentiles, Hyndman–Fan type 7. Domains: moisture 0–100, temperature 0–50, light 0–100000. An unknown sensor type gets no domain clamp. For `less_than`, on is the low percentile and off is higher. For `greater_than`, the reverse.
- **Consequences:** The job sorts a few thousand rows, so a separate process would be the same kind of over-building decision 3 refused. If the cron fails, Decision keeps the old thresholds. Percentiles stay explainable and tolerate outliers. There are no labels for a supervised model. The loop is closed on purpose: the history is the world the current policy already created, not a botanical ground truth. PR #10 implemented this inside the backend, using `receivedAt` (server clock) for the window, and continuing the batch when one rule throws. It does not call Operation. The “without light/temperature” line and the domain list for temperature and light are both in this decision; the merged code calibrates whatever `sensorType` the rule has, using only that type’s readings. Timezone and the non-narrowing band guard were left open (decisions 23 and 22).
- **Source:** `docs/architecture.md` decision 20; commit `147143050` (2026-09-16) “Document decision #20”; learning log dated 2026-09-13; PR #10.

## 19. Thin Operation, and one MQTT client for subscribe and publish

- **Number:** 19
- **Date:** 2026-09-12
- **Status:** Accepted
- **Context:** Decision already computed `nextState` and stopped at a TODO. Readings already used one mqtt.js connection (decision 16). Commands had to go out as well, without turning the task into an IoT course.
- **Options:**
  - Put the safety checks in Decision, or put them at the single actuation door so a later manual caller takes the same path.
  - Give Operation its own MQTT client, or share one connection for subscribe and publish.
- **Decision:**
  - `OperationService.requestActuation` is the only door: hardcoded safety (maximum time `on`, minimum interval) → update `desiredState` / `desiredSince` → publish → insert `actuator_events`. A safety block is a log only: no DB write and no MQTT. `reportedState` is not updated here.
  - Decision, and later a manual API, injects Operation and awaits it (the same pattern as decision 11). Operation does not import Decision.
  - Command contract: `nissim/<device_id>/commands` and `{ actuator, state }`. The actuator name is a logical name, as in decision 10. `state` is `on` or `off`.
  - One mqtt.js connection, in a shared infra module, subscribes to readings and publishes commands.
- **Consequences:** Safety sits at the moment of actuation, so a future manual call cannot skip it. One client is one lifecycle against the broker, the same idea as the single Prisma module (decision 14). The command payload mirrors readings, so firmware can speak the same contract. PR #7 (merged 2026-09-13) extracted `MqttConnection` and left Operation empty. PR #8 closed when its base branch was deleted. PR #9 (merged 2026-09-13) implemented the door: 5 second max-on, in memory, plus the on-the-way-in check, and `source: 'rule'` from Decision. The minimum interval named here and in decision 2 is not in that implementation. Boot re-arm and `OnModuleDestroy` stayed open (decision 21).
- **Source:** `docs/architecture.md` decision 19; commit `ea42229` (2026-09-12); PRs #7 and #9.

## 18. Build the backend / AI / infra spine; edge stays optional

- **Number:** 18
- **Date:** 2026-09-12
- **Status:** Accepted
- **Context:** The original architecture doc had a draft ten-step roadmap that included firmware, a frontend, ML, LLM, and optional RAG as build stages. By this date, Compose, Prisma, ingestion plus MQTT subscribe, Decision, CI, and a Terraform skeleton already existed (original stages 1–4 and part of 7). The learning goal is backend architecture, the database, ML/LLM, and infra. Firmware, and Mosquitto beyond the pipe that already works, are a boundary rather than the subject.
- **Options:**
  - Continue into firmware and a richer edge next.
  - Finish a thin Operation, then ML, LLM, a small approve API, and real GCP, and leave the edge optional.
- **Decision:** Remaining order: (1) thin Operation, (2) ML batch on `automation_rules`, (3) LLM plus a `suggestions` table, (4) a thin API to approve a suggestion, (5) real GCP resources, then WIF / plan / deploy, (6) frontend only if we want it. Firmware, ack / `reportedState`, the watchdog, and RAG stay out of scope unless a later decision includes them.
- **Consequences:** LLM and ML depend on stored data and on clear layers, not on an ESP32. Thin Operation is the only door to the physical world (decision 2) and writes `actuator_events` for a later explanation. Real infra comes after there is something to deploy. Same restraint as decision 3. Operation has since landed (PR #9) and the ML batch has since landed (PR #10). The roadmap section in `docs/architecture.md` now lists those as present. Still listed as remaining: LLM and `suggestions`, the approve API, real GCP, optional frontend.
- **Source:** `docs/architecture.md` decision 18; commit `ea42229` (2026-09-12); PR #7 body.

## 17. Remove the Claude PR-review workflow

- **Number:** 17
- **Date:** 2026-09-10
- **Status:** Accepted
- **Context:** Decision 8 added `.github/workflows/pr-review.yml` as an advisory check. In practice the action exited immediately and posted no review. On a one-person pull request that red check looked like a gate even when CI was green. PR #3 added `--allowedBots "*"` so the action could comment as a bot. PR #5 removed that flag because `claude-code-action@v1` forwarded it to a CLI that does not recognize it, and the job crashed on startup. The PR #6 review on 2026-09-10 called deleting the workflow a good call.
- **Options:**
  - Keep the official action as an advisory GitHub check.
  - Delete the workflow and leave review to a person (or to Claude in chat) when someone asks.
- **Decision:** Delete `.github/workflows/pr-review.yml`. The gate stays `ci.yml` only: lint, typecheck, tests, docker, terraform, commitlint. Human or Claude review stays manual in chat, not a GitHub check.
- **Consequences:** A red check that never produced a review was more confusing than having no bot. This does not bring back the custom bot that decision 8 rejected. The official action is gone while it fails closed. The decision says it can return if the action becomes stable. The note added to decision 8 is that this entry cancels the workflow and leaves 8 in the log as history. The review’s teaching point: CI checks are a product surface; a red check with no feedback trains people to ignore red.
- **Source:** `docs/architecture.md` decision 17; commit `0821a0c` (2026-09-10); PRs #3, #5, and #6.

## 16. MQTT client is mqtt.js

- **Number:** 16
- **Date:** 2026-09-06
- **Status:** Accepted
- **Context:** Ingestion had to listen to Mosquitto under the contract in decision 10 (`nissim/<device_id>/readings` plus JSON). Nest also offers MQTT as a microservices transport (`@MessagePattern`).
- **Options:**
  - `@nestjs/microservices` MQTT.
  - The `mqtt` package (mqtt.js) as an ordinary client.
- **Decision:** mqtt.js, originally described as a client inside `IngestionModule`. The subscriber connects in `OnModuleInit`, subscribes to `nissim/+/readings`, passes `deviceId` from the topic and the payload to `IngestionService.ingest()`, and closes in `OnModuleDestroy`. The mock publisher is a separate process, not the Nest process, and publishes to the same broker — the contract the ESP32 will use.
- **Consequences:** Nest microservices MQTT is aimed at Nest-to-Nest (framework patterns and serializers). A device publishes a topic and bytes. mqtt.js is that contract with no extra runtime in front of it. Connect and reconnect belong to the subscriber lifecycle (the same idea as Prisma in decision 14), not to an HTTP adapter. PR #6’s review agreed with this choice. Decision 19 later moved subscribe and publish onto one shared `MqttConnection`. The sentence in decision 16 that places the client inside `IngestionModule` is the original wording; the code follows decision 19.
- **Source:** `docs/architecture.md` decision 16; commit `70835d6` (2026-09-06); PR #6.

## 15. `desiredState` / `reportedState` are an enum

- **Number:** 15
- **Date:** 2026-09-03
- **Status:** Accepted
- **Context:** While planning `evaluate()`, `evaluateHysteresis` expected `currentState: 'on' | 'off'`, and the schema fields were plain `String`.
- **Options:**
  - Leave the fields as free strings.
  - Change `desiredState` and `reportedState` to an enum, on the same pattern as `ThresholdOperator`, `DecisionSource`, and `ThresholdSource`.
- **Decision:** `ActuatorState { on, off }` for those two fields.
- **Consequences:** A closed set known in advance (a physical relay) is a type, so illegal states are unrepresentable. Decision 10 already drew the line: enum for a closed code vocabulary; `String` for data that should stay configurable in the database. `Sensor.type` and `Actuator.type` stay `String`. A Postgres native enum is painful to change later; that cost is accepted because on/off is a stable binary relay state, and the schema already takes the same cost elsewhere. A non-binary actuator (a dimmer) is not planned. If one is required, the path named here is a targeted migration or a separate field on that actuator, not stretching this shared enum. Same early-overbuild refusal as decision 3.
- **Source:** `docs/architecture.md` decision 15; commit `2ac06cc` (author date 2026-09-03); PR #1.

## 14. Prisma is one global module

- **Number:** 14
- **Date:** 2026-09-03
- **Status:** Accepted
- **Context:** Almost every planned module (Decision, Ingestion, API, Operation, ML, LLM) needs Postgres through Prisma. The choice was one shared instance, registered once, or `imports: [PrismaModule]` repeated in every module that touches the database.
- **Options:**
  - Explicit `PrismaModule` import in each feature module.
  - One `PrismaService` wrapped in a `@Global()` module and registered once.
- **Decision:** `PrismaService extends PrismaClient`, connects explicitly in `OnModuleInit` (`$connect()`), and closes on `OnModuleDestroy` / shutdown. `PrismaModule` is `@Global()`, registered once on `AppModule`, and lives under `backend/src/prisma/`.
- **Consequences:** `@Global()` is a conscious Nest escape hatch, used because database access is needed in almost every module, the usual pattern for a single infra service (database, logging, config). New feature modules do not repeat the import.
- **Source:** `docs/architecture.md` decision 14; commit `2ac06cc` (2026-09-03); PR #1.

## 13. Unique `(planterId, sensorType, actuatorType)` on rules

- **Number:** 13
- **Date:** 2026-09-03
- **Status:** Accepted
- **Context:** `DecisionService` finds the rule for a reading by planter and sensor type. There is no real foreign key from sensors or actuators to `automation_rules`; matching is by string. The open worry was two conflicting rules on the exact same actuator.
- **Options:**
  - An application check only.
  - A database unique constraint on `(planterId, sensorType, actuatorType)`.
  - Replace `sensorType` / `actuatorType` strings with real `sensorId` / `actuatorId` foreign keys. Considered and set aside for now.
- **Decision:** The unique constraint is in the database, not only in the service. Rules that share a `sensorType` and differ in `actuatorType` (temperature → fan and temperature → mister) are valid. `DecisionService` evaluates each matching rule on its own actuator.
- **Consequences:** A bad seed or a hand edit cannot insert two rules for the same planter, sensor type, and actuator type. Foreign keys would also stop typos and drift, and they would force a rule edit when a physical sensor or actuator of the same type is swapped. String matching keeps working with new hardware of the same type on that planter. The decision leaves that trade-off open.
- **Source:** `docs/architecture.md` decision 13; commit `2ac06cc` (2026-09-03); PR #1.

## 12. Hysteresis reads `desiredState`

- **Number:** 12
- **Date:** 2026-09-03
- **Status:** Accepted
- **Context:** Hysteresis (decision 9) needs the actuator’s current state so it knows whether to compare the new reading with the on threshold or the off threshold.
- **Options:**
  - Read `Actuator.desiredState`.
  - Read `Actuator.reportedState`.
- **Decision:** `DecisionModule` reads `desiredState`.
- **Consequences:** `reportedState` lags `desiredState` by ack latency. Comparing against it would forget a command already sent and send a second one while the first was in flight. The gap between desired and reported (decision 6) stays a separate concern: execution integrity on a longer timer (the scheduled watchdog, not built), not intent on every single reading. Treating that lag as a fault would mark every normal command as a failure.
- **Source:** `docs/architecture.md` decision 12; commit `2ac06cc` (2026-09-03); PR #1.

## 11. Ingestion calls Decision directly

- **Number:** 11
- **Date:** 2026-09-03
- **Status:** Accepted
- **Context:** Decision 6 said every `sensor_readings` insert runs the decision check in the same handler. It did not say how `IngestionModule` reaches `DecisionModule` in code.
- **Options:**
  - `@nestjs/event-emitter`.
  - A direct call: `IngestionService` injects `DecisionService` and awaits it after the insert.
- **Decision:** Direct dependency injection and `await`. No event emitter.
- **Consequences:** There is one consumer of “a reading was stored” (the decision engine), so fan-out is not earning its indirection. This is the automatic loop of a safety-critical system (decision 2). With `EventEmitter2`, an exception inside a listener does not return to the emitter by default, so an evaluation bug can vanish. `await` makes the failure visible and logged. The call stays in the source, which is the same visibility goal as decision 5. If a second independent consumer appears (the example given is a WebSocket push to a dashboard), that is the time to look at an emitter again.
- **Source:** `docs/architecture.md` decision 11; commit `2ac06cc` (2026-09-03); PR #1. PR #4 implemented `ingest` → `await DecisionService.evaluate` with no try/catch around that call.

## 10. MQTT ingestion contract: topic, payload, logical sensor name

- **Number:** 10
- **Date:** 2026-09-03
- **Status:** Accepted
- **Context:** Ingestion planning (then roadmap item 4) had to choose a temporary REST mock or real MQTT. Mosquitto was already in Docker Compose. The firmware (then a later roadmap item) and the backend still needed a contract.
- **Options:**
  - A temporary REST ingest, replaced when firmware exists.
  - Real MQTT from the first mock, so there is one ingestion path.
  - A shared enum for sensor identity in the payload and in the backend.
  - A stable logical name, checked against `Sensor.name` at ingest time.
- **Decision:**
  - Mock through real MQTT. That avoids a second ingestion implementation to throw away, and it exercises decision 1.
  - Topic: `nissim/<device_id>/readings`. Every sensor on the device uses that one topic. Ingestion listens for the device as a whole.
  - Payload: `{ sensor, value, recorded_at }`. One message per reading, no batching. `sensor` is a stable logical name (example `"moisture_1"`), not the Postgres id.
  - The backend maps `(device_id, sensor)` to a `sensors` row through the existing `Sensor.name`, and rejects unknown names. Not an enum.
- **Consequences:** An enum fits a closed code vocabulary (`DecisionSource`, `ThresholdOperator`), which is the same line as decision 9. It does not fit entities that are supposed to be defined in the database. An enum for sensor identity would need a code change, a migration, and a redeploy to add a sensor, which fights the reason the `sensors` table exists. Firmware is C++ and cannot share a TypeScript enum anyway. JSON across languages still needs a runtime check. Validating `Sensor.name` catches a typo or a mismatch without freezing specific devices into code.
- **Source:** `docs/architecture.md` decision 10; commit `2ac06cc` (2026-09-03); PR #1. PR #4 implemented validation and the Decision handoff. The subscriber arrived in PR #6.

## 9. One evaluation path; ML calibrates thresholds

- **Number:** 9
- **Date:** 2026-08-19
- **Status:** Accepted
- **Context:** Decision 2 said rules and ML together run the loop, and it did not define the relationship. The question came up while planning `DecisionModule`: are rule and ML two evaluators that need conflict resolution, or one path?
- **Options:**
  - Two evaluators, plus logic for when they disagree.
  - One evaluation path. ML only updates the thresholds in the table.
- **Decision:** One path. `DecisionModule` always evaluates threshold rules from `automation_rules`, with hysteresis (separate on and off thresholds, not one threshold). The ML batch job (later decision 20) only updates those thresholds from collected data. It does not produce an actuator decision. Cold start is “default thresholds ML has not updated yet,” not a separate code path.
- **Consequences:** `DecisionModule` can be unit-tested with no ML process running, and there is no referee between two evaluators. Schema: `onThreshold` / `offThreshold` plus `operator`, replacing a single `thresholdValue` (the gap was already commented in the schema), plus provenance (hand seed versus ML update). Under this design `decision_source` on `actuator_events` is always `'rule'`. The `'ml'` enum value stays reserved for a future direct-ML path and is unused. Commit `3ff48ae` added the hysteresis columns and the ML provenance field.
- **Source:** `docs/architecture.md` decision 9; commit `3ff48ae` (2026-08-19).

## 8. PR review via `anthropics/claude-code-action`

- **Number:** 8
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** Automatic review on every Nissim pull request, judged against 12-factor and against real review tools (CodeRabbit, Copilot review). At 16:50 the same day, this number was a custom bot: a GitHub Actions job, a hand-written read-only agent loop, inline review comments, built-in `GITHUB_TOKEN`, code in a package outside `backend/`, advisory only. At 17:02 commit `002372c` replaced that text. The commit message says a v1 single-shot bot “ships” and v2 stays future. The diff in that commit is the opposite: it rejects the custom bot. The file text below is the decision that remained. Decision 17 later removed the workflow.
- **Options:**
  - Custom bot. First draft: manual agent loop and inline comments. Revised shape, then rejected: v1 single-shot comment on the diff, v2 later as a read-only agent loop with inline comments (the same pattern as decision 5), about 150–800 lines of TypeScript, in a package separate from `backend/`.
  - `anthropics/claude-code-action@v1`, the official action (September 2025) that runs Claude Code in the runner (files, git, shell) and supports automatic pull-request review.
- **Decision:** Use the existing action. Zero custom code: workflow YAML, plus a GitHub App install from the Claude Code terminal (`/install-github-app`), which needs an interactive approval and cannot be fully automated. Trigger: `pull_request` opened and synchronize. The checklist lives in the action config and includes 12-factor and principles already written in `architecture.md` / `git-workflow.md` (separation of concerns in the AI layers, `decision_source` on `actuator_events`). Gate: advisory only, not a required check. See `git-workflow.md`.
- **Consequences:** A custom bot would have practiced tooling, not the core loop. That is a different trade from decision 5, where a framework would have hidden the agent mechanism the project exists to learn. Here the action hides nothing that was planned as application architecture. A maintained Anthropic action was preferred to custom code with no matching learning value. PR #2 added `pr-review.yml`. Decision 17 (2026-09-10) deleted that workflow after the action failed on every pull request. The entry stays as history; the cancellation sentence in `architecture.md` points at 17.
- **Source:** `docs/architecture.md` decision 8; commits `e974e13` and `002372c` (both 2026-08-15); removal in decision 17.

## 7. One ESP32 for both planters

- **Number:** 7
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** The two planters are on a balcony, close to each other. The main risk of a shared controller — noise on a long analog moisture cable — does not apply at that distance.
- **Options:**
  - One controller per planter.
  - One shared ESP32.
- **Decision:** One ESP32, with a sensor pair and relays per planter on separate GPIOs.
- **Consequences:** Less cost and less network and firmware complexity. Accepted trade-off: a single point of failure. If the ESP32 dies, telemetry and control drop for both planters together. Schema: `devices` is physical hardware and is not tied to one `planter_id`. `planter_id` lives on `sensors` and `actuators`. Each sensor or actuator belongs to one planter even when they share a device.
- **Source:** `docs/architecture.md` decision 7; commit `e974e13` (2026-08-15).

## 6. Reactive trigger, manual override, desired vs reported

- **Number:** 6
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** After the AI layers (decision 2), the runtime was still open: when the loop runs, what a manual watering may skip, and how to know a command actually ran rather than only that it was sent.
- **Options:**
  - Trigger on a poll interval, or react to each new reading. The ML batch (threshold update) and the quiet-device watchdog need a time window, so those stay scheduled either way.
  - Let a manual override skip every layer, or let it skip only the decision layer.
  - One state field, or separate desired and reported state.
- **Decision:**
  - Reactive. Every `sensor_readings` insert runs the rule/ML check immediately, in that same handler. The ML batch job and the watchdog are scheduled.
  - Manual override bypasses only the decision layer (rule/ML). The hardcoded physical caps (decision 2, layer 1) still apply to a manual action.
  - `actuators` stores `desired_state` / `desired_since` (updated when a command is sent) and `reported_state` / `reported_at` (updated only when the ESP32 sends an ack). A lasting gap is a fault signal and a possible watchdog input.
- **Consequences:** MQTT is already event-based, so a poll on top of it adds nothing. The override can bypass a decision and cannot bypass a physical guard. Desired versus reported records the gap between “sent” and “the device did it,” which matters because the ESP32 is behind NAT and a command can simply never arrive. Decision 18 later put ack / `reportedState` and the watchdog out of scope until a new decision includes them. The columns exist; the ack path does not.
- **Source:** `docs/architecture.md` decision 6; commit `e974e13` (2026-08-15).

## 5. Hand-written Claude tool loop, inside the LLM module

- **Number:** 5
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** There was prior experience with Google ADK. Using it here would not add learning, and ADK is Python/Java only, which does not survive the move to Node/TypeScript (decision 4). The project wants the agentic tool-calling mechanism visible, not hidden inside a framework.
- **Options:**
  - Google ADK.
  - A hand-written loop against the Claude Messages API.
  - An agent framework such as LangGraph.js, left as a future option if the orchestration needs multi-node state and real checkpointing. Not required now, because human approval of a suggestion is a normal API endpoint, not an interrupt inside the agent run.
- **Decision:** Implement the loop by hand: `tools` parameter, check `stop_reason`, run the tool in code, send `tool_result` back, cap `max_tool_calls`. It lives only in the LLM module (insights/chat). It is not mixed into ingestion, the API, the safety layer, or the decision engine.
- **Consequences:** The agent receives only read tools, or a tool that writes a row to the suggestions table. It never receives a tool that actuates. Writing the loop exposes message history, `tool_use` detection, and trace logging. This module is designed and not built (decision 18).
- **Source:** `docs/architecture.md` decision 5; commit `e974e13` (2026-08-15).

## 4. NestJS and Prisma

- **Number:** 4
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** This replaces an earlier choice of Python, FastAPI, and SQLAlchemy. That earlier choice is described in this decision and was not given its own number. The learning goal is writing code. Most of the code is backend, so the backend should be the language being practiced (JavaScript/TypeScript), not a language that already has prior experience behind it.
- **Options:**
  - Python, FastAPI, and SQLAlchemy (the previous choice).
  - NestJS and Prisma.
- **Decision:** NestJS (structured framework, dependency injection — the closest philosophical match to FastAPI) and Prisma (schema and migrations) for Postgres.
- **Consequences:** A standard Node plus Postgres stack. `prisma migrate dev` produces migrations a person can read, and the client is typed. Early queries should stay explicit so it remains obvious which SQL hits the database. Decision 5 follows from this, because ADK does not target this stack.
- **Source:** `docs/architecture.md` decision 4; commit `e974e13` (2026-08-15).

## 3. Plain Postgres

- **Number:** 3
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** `sensor_readings` is a high-volume time series.
- **Options:**
  - TimescaleDB.
  - Plain Postgres with a composite index `(sensor_id, received_at DESC)`.
- **Decision:** Plain Postgres with that index.
- **Consequences:** At two planters (about 9k rows a day), Postgres is enough. TimescaleDB is worth knowing about and is not in use. Later decisions (15, 18, 20) reuse this “do not build the edge before it is needed” line.
- **Source:** `docs/architecture.md` decision 3; commit `e974e13` (2026-08-15).

## 2. Safety and rules/ML run the loop; LLM is on demand

- **Number:** 2
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** Control of a physical pump is safety-critical. An LLM is non-deterministic, slow, expensive, and depends on an external API, so it is a poor automatic decider to run over and over. Safety, and cost plus reliability, reach the same conclusion from different directions.
- **Options:**
  - Let the LLM participate in the repeating actuator decision.
  - Three layers, with the LLM outside that loop.
- **Decision:** Three layers. The LLM does not participate in the automatic decision loop at all.
  1. **Safety**, hardcoded, enforced in the Operation module at the moment of physical actuation, independent of who requested it (not only a ceiling on some other layer). Examples named: maximum pump-on time, and a minimum gap between waterings.
  2. **Classical ML**, learned from data and deterministic (the same input yields the same output until the next training). Cold start is a heuristic or a threshold, because day one has no data. Later, a simple regression on collected data. Rules and ML together run the whole routine loop, so the system keeps working if the LLM API is down.
  3. **LLM**, on demand only: an answer to a user question (chat), or a scheduled job that writes an explanation (a daily summary). Never part of the actuator decision. It works as an agent with multi-turn tool calling (hand-written against the Claude API, decision 5). The model chooses which tools to call. Data is not pushed in advance. Proposals to change `automation_rules` are written to a separate suggestions table (`status=pending`) and need an explicit human approval (a normal API endpoint, not part of the agent run) before they take effect. No auto-apply.
- **Consequences:**
  - An iteration cap on the agent loop (`max_tool_calls`), as an operational guard on cost and latency, in addition to physical safety.
  - Every tool is a defined, bounded query (the example given is `get_recent_readings(planter_id, days)` with a range cap). Not open SQL.
  - A full trace of the tool-call sequence, not only the final text, for explanation and later debugging.
  - `decision_source` on `actuator_events` is how a later reader answers “why did the pump turn on.” The LLM is never a direct source.
  - Decision 9 narrows “rules and ML together” to one hysteresis path. Decision 20’s v1 is percentile calibration, and it leaves the “simple regression later” line for a later lesson. The minimum gap between waterings is named here and in decision 19; the code merged in PR #9 enforces max-on and does not enforce that gap.
- **Source:** `docs/architecture.md` decision 2; commit `e974e13` (2026-08-15).

## 1. MQTT with self-hosted Mosquitto

- **Number:** 1
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** The ESP32 devices sit behind NAT and have no public IP. The server cannot push to them with ordinary HTTP.
- **Options:**
  - HTTP polling.
  - Google Cloud IoT Core. Recorded as deprecated in 2023, so it was not an available hosted broker.
  - MQTT with self-hosted Mosquitto.
- **Decision:** MQTT with self-hosted Mosquitto.
- **Consequences:** Actuator commands ride an open TCP connection, so latency is not a poll interval. Last Will Testament can show a device going offline. Retained messages can give a newly opened dashboard the current status. Publishers and subscribers stay decoupled. Docker Compose runs Mosquitto as its own service. Decision 10 is the reading contract on that broker. Decision 19 is the command contract.
- **Source:** `docs/architecture.md` decision 1; commit `e974e13` (2026-08-15). `docker-compose.yml` cites this decision.

## Infrastructure decisions with no number

These are the `Decision:` sections in [`docs/infra-terraform.md`](../infra-terraform.md), plus the folder-per-environment choice in that doc and the dev/prod rename. They were introduced in commit `e974e13` on 2026-08-15 except the rename. This file does not assign them numbers.

### Environment roots are named dev and prod

- **Number:** none in the history
- **Date:** 2026-09-03
- **Status:** Accepted
- **Context:** The skeleton named the Terraform environment folders `staging` and `production`. PR #2 renamed them as part of adding GitHub Actions.
- **Options:**
  - Keep `staging` / `production`.
  - Rename the folders and the docs to `dev` / `prod`.
- **Decision:** `infra/terraform/environments/dev` and `environments/prod`. `git-workflow.md` matches: one shared dev environment (the last branch that deploys overwrites it), and prod only from `main`, behind a GitHub Environment required reviewer. Deploy jobs skip until `WIF_PROVIDER` / `WIF_SERVICE_ACCOUNT` exist.
- **Consequences:** Docs, workflow files, and the Terraform roots use the same two names. There is no per-PR preview environment.
- **Source:** commit `ee2bc37` (2026-09-03); PR #2; `docs/git-workflow.md`; `docs/infra-terraform.md`.

### Separate Terraform roots per environment

- **Number:** none in the history
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** Dev and prod need isolated state. Terraform workspaces are a common way to share one root across environments.
- **Options:**
  - `terraform workspace`.
  - A directory per environment, each with its own remote state in GCS.
- **Decision:** A directory per environment under `infra/terraform/environments/`. Not workspaces. The recorded reason is HashiCorp’s guidance: workspaces risk mixing state. Separate directories are separate state.
- **Consequences:** `dev` and `prod` do not share a state file. CI runs `fmt -check` and `validate` on bootstrap and on both environments (see `git-workflow.md`). `plan` is not in CI yet; it waits on WIF and on real environment config.
- **Source:** `docs/infra-terraform.md`, commit `e974e13` (2026-08-15).

### One GCP project for dev and prod

- **Number:** none in the history
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** A personal-scale project still needs two environments.
- **Options:**
  - Two GCP projects, one per environment.
  - One shared GCP project, with resources named and labeled per environment (example `nissim-db-dev`).
- **Decision:** One GCP project. Resources are tagged or named per environment inside it.
- **Consequences:** Cheaper and simpler at this scale. Less isolation than two projects, which the doc calls the full practice in a real organization and says to reconsider if the project grows. The example name was `nissim-db-staging` until the 2026-09-03 rename.
- **Source:** `docs/infra-terraform.md`, commit `e974e13` (2026-08-15); rename in `ee2bc37`.

### Bootstrap the state bucket with Terraform

- **Number:** none in the history
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** A remote backend needs a bucket, and creating that bucket wants Terraform. Doing the bucket by hand would leave infrastructure as code.
- **Options:**
  - Create the state bucket manually, then point Terraform at it.
  - A separate `bootstrap/` config with local state, run once.
- **Decision:** `infra/terraform/bootstrap/` is its own Terraform config, local state, run once. It creates the GCS bucket that backs every other root, and it enables the base APIs.
- **Consequences:** The chicken-and-egg step stays in IaC. Bootstrap state is local; environment roots use the bucket. Commit `1c801f9` (2026-08-15) is the bootstrap implementation (GCS bucket and base API enablement).
- **Source:** `docs/infra-terraform.md`; commit `e974e13`; implementation `1c801f9`.

### Cloud SQL through the Auth Proxy

- **Number:** none in the history
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** The backend (a Compute Engine VM, decision below) must reach Postgres.
- **Options:**
  - Private IP plus a VPC connector (full VPC peering).
  - Cloud SQL Auth Proxy: a public IP, with mTLS, authenticated by IAM.
- **Decision:** Cloud SQL Auth Proxy. The database is not open to the world. Fewer moving parts than Private IP, and enough for this project’s scale.
- **Consequences:** The database module is Cloud SQL (small tier) plus database and user, reached through the proxy. This is design; the VM itself is deferred (next entries, and decision 18).
- **Source:** `docs/infra-terraform.md`, commit `e974e13` (2026-08-15).

### GitHub Actions authenticates with Workload Identity Federation

- **Number:** none in the history
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** CI will need to call GCP. A long-lived service-account JSON key stored as a GitHub secret can leak.
- **Options:**
  - A GCP service-account JSON key in a GitHub secret.
  - Workload Identity Federation: GitHub Actions receives a short-lived token via OIDC.
- **Decision:** Workload Identity Federation. Set it up in the IAM module now, before CI/CD needs it, so it does not become a later refactor.
- **Consequences:** The IAM module includes a service account bound to WIF for GitHub Actions, plus separate least-privilege service accounts for the two planned VMs (broker and backend). PR #2 added deploy workflows that skip until the WIF environment variables exist. `plan` on pull requests is still waiting on that.
- **Source:** `docs/infra-terraform.md`; `docs/git-workflow.md`; PR #2.

### Backend and broker on two Compute Engine VMs

- **Number:** none in the history
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** The backend holds a continuous MQTT subscription (decision 6). The same constraint already rules Cloud Run out for the broker.
- **Options:**
  - Cloud Run for the backend.
  - One shared VM for broker and backend.
  - Two Compute Engine VMs, one module each.
- **Decision:** The backend does not run on Cloud Run. Scale-to-zero would break the long-lived connection, and horizontal autoscaling would break shared state. Broker and backend run on two separate Compute Engine VMs. The recorded reasons are real isolation, and a full Terraform exercise (a VM module for each). The extra cost named in the doc is one more e2-micro, about $6–7 a month.
- **Consequences:** The long-lived MQTT client and the broker do not share a machine or a scale-to-zero runtime. This chooses the target. The following entry defers creating the VMs.
- **Source:** `docs/infra-terraform.md`, commit `e974e13` (2026-08-15).

### Broker and backend VMs are deferred

- **Number:** none in the history
- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** The Compute Engine choice above names two VMs. This entry says when they are created.
- **Options:**
  - Add the broker VM and the backend VM in the current Terraform stage.
  - Defer both VMs until device integration, and build the surrounding resources now.
- **Decision:** This stage is networking (custom VPC, subnet, firewall — not the default network), Cloud SQL, Artifact Registry, IAM / WIF, Secret Manager placeholders (values out of band, not in git tfvars), and a billing budget. The broker VM and the backend VM (a Compute Engine module per VM) are added when integration with the real devices starts. The doc points at the roadmap in `architecture.md` for that stage.
- **Consequences:** The repo has module skeletons and no broker or backend VM yet. Decision 18 (2026-09-12) later ordered real GCP after the LLM and the approve API, and it left firmware optional. The infra doc still ties the VMs to device integration. Those two schedules are both in the repo and they do not say the same thing.
- **Source:** `docs/infra-terraform.md`, commit `e974e13` (2026-08-15); tension with decision 18.
