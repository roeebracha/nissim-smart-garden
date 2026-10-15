export type SensorTile = {
  type: string
  title: string
  technical: string
  plain: string
  unit: string
}

// Tiles the balcony hardware is expected to fill. A missing type stays an
// empty tile. Sensor.type is a free string (decision 10); this list does
// not insert rows.
export const SENSOR_TILES: SensorTile[] = [
  {
    type: 'temperature',
    title: 'Temperature',
    technical: 'SHT31',
    plain: 'Air temperature',
    unit: '°C',
  },
  {
    type: 'humidity',
    title: 'Humidity',
    technical: 'SHT31',
    plain: 'Air humidity',
    unit: '%',
  },
  {
    type: 'light',
    title: 'Light',
    technical: 'BH1750',
    plain: 'How bright the light is',
    unit: 'lx',
  },
  {
    type: 'water_level',
    title: 'Water level',
    technical: 'Tank float',
    plain: 'Whether the tank still has water',
    unit: '',
  },
  {
    type: 'moisture',
    title: 'Soil moisture',
    technical: 'Probe',
    plain: 'How wet the soil is',
    unit: '%',
  },
]

export function formatReading(type: string, value: number, unit: string): string {
  if (type === 'water_level') {
    if (value === 0) return 'Empty'
    if (value === 1) return 'Has water'
  }
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return unit ? `${rounded} ${unit}` : rounded
}
