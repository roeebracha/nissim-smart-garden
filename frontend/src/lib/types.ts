export type ReadingPoint = {
  id: number
  value: number
  recordedAt: string
  receivedAt: string
}

export type Sensor = {
  id: number
  name: string
  type: string
  latestReading: ReadingPoint | null
}

export type ActuatorState = 'on' | 'off'

export type Actuator = {
  id: number
  name: string
  type: string
  planterId: number
  desiredState: ActuatorState
  desiredSince: string
  reportedState: ActuatorState
  reportedAt: string
}

export type Planter = {
  id: number
  name: string
  sensors: Sensor[]
  actuators: Actuator[]
}

export type Suggestion = {
  id: number
  summary: string
  planterId: number | null
  sensorType: string
  actuatorType: string
  status: string
}

export type SuggestionResult = {
  suggestions: Suggestion[]
  approveAvailable: boolean
}

export type GardenClient = {
  getPlanters: () => Promise<Planter[]>
  getActuators: () => Promise<Actuator[]>
  getReadings: (sensorId: number, since: string) => Promise<ReadingPoint[]>
  getSuggestions: () => Promise<SuggestionResult>
  approve: (id: number) => Promise<void>
}
