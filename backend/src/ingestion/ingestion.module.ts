// Ingestion module — owns the MQTT subscription that receives sensor readings
// from the ESP32 (or, for now, the mock publisher — see docs/architecture.md
// decision #10 for the topic/payload contract).
//
// Needs DecisionModule imported so IngestionService can inject DecisionService
// directly (decision #11 — no event emitter).
//
// Empty for now - fill in providers/imports once IngestionService exists.
import { Module } from '@nestjs/common';

@Module({})
export class IngestionModule {}
