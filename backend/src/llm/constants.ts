// Caps for the on-demand agent (decision #2). The architecture requires a
// cap; it does not fix the number. 5 is the value this module uses.
export const MAX_TOOL_CALLS = 5;

// Same window as nightly calibration (decision #20). A larger `days`
// is rejected and does not query.
export const MAX_READING_DAYS = 7;

// Newest rows only, so a full week cannot fill the model context.
export const MAX_READING_ROWS = 200;

// Dashboard text stored on the suggestion. Longer text is rejected.
export const MAX_SUMMARY_CHARS = 2000;

// Output budget for one Claude turn. Separate from the tool-call cap.
export const MAX_OUTPUT_TOKENS = 1024;

// One Claude HTTP call. MAX_TOOL_CALLS limits how many rounds we pay
// for; this limits how long one round can sit on a stuck socket.
// 30 seconds is enough for a short garden answer.
export const LLM_REQUEST_TIMEOUT_MS = 30_000;

// Suggestion boundary. Ingestion still accepts any Sensor.type string.
// These are the strings Decision already matches.
export const SENSOR_TYPES = ['moisture', 'light', 'temperature'] as const;
export const ACTUATOR_TYPES = ['pump', 'light'] as const;

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';

export const GET_RECENT_READINGS = 'get_recent_readings';
export const SUGGEST_RULE_CHANGE = 'suggest_rule_change';
