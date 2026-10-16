import type {
  Actuator,
  GardenClient,
  Planter,
  ReadingPoint,
  Suggestion,
} from '@/lib/types'

const at = (hour: number, minute: number) =>
  new Date(Date.UTC(2026, 9, 16, hour, minute)).toISOString()

function series(seed: number, start: number, step: number): ReadingPoint[] {
  return Array.from({ length: 8 }, (_, index) => {
    const recordedAt = at(6, index * 30)
    return {
      id: seed * 100 + index,
      value: start + index * step,
      recordedAt,
      receivedAt: recordedAt,
    }
  })
}

function reading(id: number, value: number): ReadingPoint {
  const recordedAt = at(10, 0)
  return { id, value, recordedAt, receivedAt: recordedAt }
}

const teaPump: Actuator = {
  id: 1,
  name: 'tea-pump',
  type: 'pump',
  planterId: 1,
  desiredState: 'on',
  desiredSince: at(9, 58),
  reportedState: 'off',
  reportedAt: at(9, 0),
}

const teaLamp: Actuator = {
  id: 2,
  name: 'grow-lamp',
  type: 'light',
  planterId: 1,
  desiredState: 'off',
  desiredSince: at(7, 0),
  reportedState: 'off',
  reportedAt: at(7, 0),
}

const pepperPump: Actuator = {
  id: 3,
  name: 'pepper-pump',
  type: 'pump',
  planterId: 2,
  desiredState: 'off',
  desiredSince: at(8, 0),
  reportedState: 'off',
  reportedAt: at(8, 0),
}

export const demoActuators: Actuator[] = [teaPump, teaLamp, pepperPump]

export const demoPlanters: Planter[] = [
  {
    id: 1,
    name: 'Tea',
    actuators: [teaPump, teaLamp],
    sensors: [
      { id: 1, name: 'tea-temp', type: 'temperature', latestReading: reading(11, 24.2) },
      { id: 2, name: 'tea-humidity', type: 'humidity', latestReading: reading(12, 61) },
      { id: 3, name: 'tea-light', type: 'light', latestReading: reading(13, 820) },
      { id: 4, name: 'tea-float', type: 'water_level', latestReading: reading(14, 1) },
      { id: 5, name: 'tea-moisture', type: 'moisture', latestReading: reading(15, 38) },
    ],
  },
  {
    id: 2,
    name: 'Peppers',
    actuators: [pepperPump],
    sensors: [
      { id: 6, name: 'pepper-temp', type: 'temperature', latestReading: reading(21, 26.1) },
      { id: 7, name: 'pepper-humidity', type: 'humidity', latestReading: reading(22, 55) },
      { id: 8, name: 'pepper-light', type: 'light', latestReading: reading(23, 640) },
      { id: 9, name: 'pepper-float', type: 'water_level', latestReading: reading(24, 0) },
      { id: 10, name: 'pepper-moisture', type: 'moisture', latestReading: reading(25, 22) },
    ],
  },
]

export const demoHistory: Record<number, ReadingPoint[]> = {
  1: series(1, 22, 0.3),
  2: series(2, 58, 0.4),
  3: series(3, 400, 60),
  4: series(4, 1, 0),
  5: series(5, 44, -0.8),
  6: series(6, 25, 0.2),
  7: series(7, 50, 0.6),
  8: series(8, 300, 50),
  9: series(9, 0, 0),
  10: series(10, 30, -1),
}

export const demoSuggestions: Suggestion[] = [
  {
    id: 7,
    summary: 'Lower the tea moisture on-threshold to 30 so the pump waits a little longer.',
    planterId: 1,
    sensorType: 'moisture',
    actuatorType: 'pump',
    status: 'pending',
  },
]

export function createDemoClient(): GardenClient {
  return {
    async getPlanters() {
      return demoPlanters
    },
    async getActuators() {
      return demoActuators
    },
    async getReadings(sensorId) {
      return demoHistory[sensorId] ?? []
    },
    async getSuggestions() {
      return { suggestions: demoSuggestions, approveAvailable: true }
    },
    async approve() {},
  }
}
