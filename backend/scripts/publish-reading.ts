// Mock MQTT publisher (decision #10, #16) — not Nest, not the subscriber process.
// Use this until ESP32 firmware exists. Same topic + JSON the firmware will send.
//
// Topic:   nissim/<device_id>/readings
// Payload: { sensor, value, recorded_at }  — sensor is Sensor.name, not the DB id.
//
// Run from the host against compose Mosquitto (localhost:1883), not the
// "mosquitto" hostname (that name only works inside the compose network).
// device_id must already exist as Device.id; sensor must exist as Sensor.name
// on that device, or ingest() will reject the message.
//
// Add the `mqtt` package when you implement; one publish then exit.
