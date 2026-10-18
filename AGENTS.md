# Nissim — agent guide

Smart-garden IoT for two planters (tea and small peppers). GitHub is the source of truth for code and for the decisions in [`docs/adr/DECISIONS.md`](docs/adr/DECISIONS.md). The Hebrew design log that those numbers come from is [`docs/architecture.md`](docs/architecture.md).

## Architecture and module boundaries

One ESP32 serves both planters (decision 7). It publishes readings to Mosquitto. This guide includes an SHT31 on that edge path. The repository’s sensor types are moisture, light, and temperature; no commit and no PR #1–#10 names the SHT31 part.

```
ESP32 (readings) → MQTT / Mosquitto → NestJS backend
                                      ├─ Ingestion   validate, save sensor_readings
                                      ├─ Decision    hysteresis rules on automation_rules
                                      ├─ Operation   safety checks, then publish the command
                                      └─ MlModule    nightly threshold calibration
Postgres via Prisma
Terraform on GCP · Docker Compose locally (postgres, mosquitto, backend)
```

- **Ingestion** subscribes to `nissim/+/readings`, checks `{ sensor, value, recorded_at }`, stores the row, then awaits Decision (decision 11). `sensor` is a logical name, matched to `Sensor.name`.
- **Decision** evaluates one hysteresis rule path (separate on and off thresholds) against `Actuator.desiredState`. It does not publish MQTT and it does not apply safety math.
- **Operation** is the only door that changes the physical world: `requestActuation` runs safety, updates `desiredState` / `desiredSince`, writes `actuator_events`, and publishes `nissim/<device_id>/commands` with `{ actuator, state }`.
- **MlModule** lives in the same backend process. A nightly cron rewrites `onThreshold` / `offThreshold` on `automation_rules`. Ingestion, Decision, and Operation do not import it.
- **Postgres / Prisma.** One global `PrismaModule`. Plain Postgres, not a time-series extension (decision 3).
- **Docker Compose** is the local stack: Postgres, Mosquitto, and one backend container. ML is not a fourth service (decision 20).
- **Terraform** under `infra/terraform/` is the GCP shape: bootstrap, modules, and separate `dev` and `prod` roots. Long-lived MQTT is why the backend and the broker are planned as Compute Engine VMs, not Cloud Run (infra notes below the numbered log).

LLM chat and suggestion approval are designed (decisions 2 and 5) and not built. Firmware, reported-state acks, and the watchdog are out of scope until a new accepted decision says otherwise (decision 18).

## Working agreement

Roee is CTO and decides architecture. The lead dev proposes.

Any structural change needs an entry in [`docs/adr/DECISIONS.md`](docs/adr/DECISIONS.md), accepted by Roee, before code is written. Keep the original number when the history already has one. New entries go at the top (newest first) with number, date, status (`Accepted` or `Proposed`), context, options, decision, and consequences.

GitHub is the source of truth. `main` is protected. Work lands through a short-lived branch and a pull request. The PR says what changed and why (conventional commit subject for the what, body for the why). Reviews are educational: they explain the failure mode and the better shape. They do not silently rewrite the author’s code.

The merge gate on this solo repo is the CI checks in `.github/workflows/ci.yml` (lint, typecheck, tests, docker build, Terraform fmt/validate, commitlint). See [`docs/git-workflow.md`](docs/git-workflow.md).

## Conventions

- **Infrastructure as code.** GCP changes go through Terraform. Do not ClickOps them in the console. Bootstrap state is Terraform too.
- **Keep it simple.** Two planters. Plain Postgres. Percentile calibration in the backend process. No extra service, database, or framework unless a decision says the simpler option fails.
- **No Kubernetes by default.** Local runtime is Docker Compose. The documented GCP runtime for the broker and the backend is Compute Engine. Kubernetes needs an accepted ADR.
- **12-factor.** Configuration comes from the environment (secrets stay out of git). Backing services (Postgres, Mosquitto) are attached resources. A process should be disposable, with the exception the decisions already call out: the MQTT subscription is long-lived, so the backend is not a scale-to-zero function.
- **Separation of concerns.** Ingestion stores readings. Decision chooses the next state. Operation is the only module that actuates. ML only writes thresholds. The LLM, when it exists, may read and may suggest rule changes; it does not actuate.

## Actuator safety rules

- Only Operation actuates. Decision, Ingestion, ML, and any future manual API call `requestActuation`. They do not publish actuator commands themselves.
- Max-on is always enforced. The implementation uses a 5 second cap (`MAX_ON_MS`): a timer after a successful `on`, and a check on the way in if the actuator has already been desired `on` longer than that.
- ML never actuates. It must not call `OperationService` or `requestActuation`. `decision_source` on events stays `rule` for this loop.
- Timers survive a restart. Re-arm the max-on timer on startup (`OnModuleInit`) from `desiredState` / `desiredSince`, and clear timers on destroy (`OnModuleDestroy`). That behavior is still **Proposed** (decision 21). The code on `main` keeps the timers in memory only, so a restart today drops the force-off.
