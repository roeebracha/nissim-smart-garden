// IngestionService — handles one incoming MQTT reading message end-to-end:
//
// 1. Parse + validate the payload against the contract in decision #10
//    ({ sensor, value, recorded_at }) — reject anything that doesn't match.
// 2. Resolve (device_id from the topic + payload.sensor logical name) to a
//    row in `sensors` via Sensor.name (decision #10) — reject unknown names.
// 3. Write the SensorReading (value, recordedAt from payload, receivedAt
//    defaults to now — see the schema comment on SensorReading).
// 4. Call DecisionService.evaluate(reading) directly and await it
//    (decision #11 — not an event emitter, so a failure here must be loud).
//
// See docs/architecture.md decisions #6, #10, #11.
import { Injectable } from '@nestjs/common';

@Injectable()
export class IngestionService {}
