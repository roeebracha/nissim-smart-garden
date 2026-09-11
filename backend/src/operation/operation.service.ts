// OperationService — only door that may change the physical world
// (decisions #2, #6, #19). Decision decides; this module actuates.
// Never import DecisionModule (no cycle). Later the manual API calls here too.
//
// requestActuation({ actuator, nextState, source }):
//   1. Hardcoded safety (max on-time, min interval between ons).
//      If blocked: log and return — no DB write, no MQTT.
//   2. Update actuator.desiredState + desiredSince.
//   3. Publish nissim/<device.deviceId>/commands
//      payload { actuator: actuator.name, state: nextState }.
//   4. Insert actuator_events (decisionSource = source).
//
// Do not touch reportedState (ack / firmware — out of scope).
import { Injectable } from '@nestjs/common';

@Injectable()
export class OperationService {}
