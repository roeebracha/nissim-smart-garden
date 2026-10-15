import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatReading, SENSOR_TILES, type SensorTile } from '@/lib/sensors'
import type {
  Actuator,
  GardenClient,
  Planter,
  ReadingPoint,
  Sensor,
  Suggestion,
} from '@/lib/types'

const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000

type ReadyState = {
  status: 'ready'
  planters: Planter[]
  actuators: Actuator[]
  suggestions: Suggestion[]
  approveAvailable: boolean
  readings: Record<number, ReadingPoint[]>
}

type ScreenState = { status: 'loading' } | { status: 'error' } | ReadyState

export function Dashboard({ client }: { client: GardenClient }) {
  const [state, setState] = useState<ScreenState>({ status: 'loading' })
  const [approvedIds, setApprovedIds] = useState<number[]>([])
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const since = new Date(Date.now() - HISTORY_WINDOW_MS).toISOString()
        const [planters, actuators, suggestionResult] = await Promise.all([
          client.getPlanters(),
          client.getActuators(),
          client.getSuggestions(),
        ])
        const entries = await Promise.all(
          planters.flatMap((planter) =>
            planter.sensors.map(async (sensor) => {
              const points = await client.getReadings(sensor.id, since)
              return [sensor.id, points] as const
            }),
          ),
        )
        if (cancelled) return
        setState({
          status: 'ready',
          planters,
          actuators,
          suggestions: suggestionResult.suggestions,
          approveAvailable: suggestionResult.approveAvailable,
          readings: Object.fromEntries(entries),
        })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client])

  async function onApprove(id: number) {
    setPendingId(id)
    setApproveError(null)
    try {
      await client.approve(id)
      setApprovedIds((ids) => [...ids, id])
    } catch {
      setApproveError('Could not approve that recommendation.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="text-sm text-muted-foreground">Two pots on the balcony</p>
        <h1 className="text-3xl">Nissim</h1>
      </header>

      {state.status === 'loading' && <p>Loading the garden…</p>}
      {state.status === 'error' && <p>Could not load the garden.</p>}
      {state.status === 'ready' && (
        <>
          {state.planters.length === 0 && <p>No planters yet.</p>}
          {state.planters.map((planter) => (
            <PlanterCard
              key={planter.id}
              planter={planter}
              actuators={actuatorsFor(planter, state.actuators)}
              readings={state.readings}
            />
          ))}
          <Recommendations
            suggestions={state.suggestions}
            approveAvailable={state.approveAvailable}
            approvedIds={approvedIds}
            pendingId={pendingId}
            approveError={approveError}
            onApprove={onApprove}
          />
        </>
      )}
    </main>
  )
}

function actuatorsFor(planter: Planter, actuators: Actuator[]): Actuator[] {
  return actuators.filter((actuator) => actuator.planterId === planter.id)
}

function PlanterCard({
  planter,
  actuators,
  readings,
}: {
  planter: Planter
  actuators: Actuator[]
  readings: Record<number, ReadingPoint[]>
}) {
  const tiles = tilesFor(planter.sensors)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{planter.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {tiles.map((tile) => (
            <SensorTileView
              key={`${planter.id}-${tile.spec.type}-${tile.sensor?.id ?? 'empty'}`}
              spec={tile.spec}
              sensor={tile.sensor}
              points={tile.sensor ? (readings[tile.sensor.id] ?? []) : []}
            />
          ))}
        </div>
        <ActuatorRow planterId={planter.id} actuators={actuators} />
      </CardContent>
    </Card>
  )
}

function tilesFor(sensors: Sensor[]): { spec: SensorTile; sensor: Sensor | null }[] {
  const used = new Set<number>()
  const known = SENSOR_TILES.map((spec) => {
    const sensor = sensors.find((item) => item.type === spec.type && !used.has(item.id))
    if (sensor) used.add(sensor.id)
    return { spec, sensor: sensor ?? null }
  })
  const extra = sensors
    .filter((sensor) => !used.has(sensor.id))
    .map((sensor) => ({
      spec: {
        type: sensor.type,
        title: sensor.type,
        technical: sensor.name,
        plain: 'Reading from the API',
        unit: '',
      },
      sensor,
    }))
  return [...known, ...extra]
}

function SensorTileView({
  spec,
  sensor,
  points,
}: {
  spec: SensorTile
  sensor: Sensor | null
  points: ReadingPoint[]
}) {
  return (
    <section className="rounded-md border border-border bg-background p-3">
      <h3 className="text-sm font-medium">{spec.title}</h3>
      <p className="text-xs text-muted-foreground">
        {spec.technical} · {spec.plain}
      </p>
      {sensor?.latestReading ? (
        <p className="mt-2 text-lg">
          {formatReading(spec.type, sensor.latestReading.value, spec.unit)}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No reading yet</p>
      )}
      <HistoryChart title={spec.title} points={points} />
    </section>
  )
}

function HistoryChart({ title, points }: { title: string; points: ReadingPoint[] }) {
  if (points.length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground">No history yet</p>
  }
  const data = points.map((point) => ({
    time: new Date(point.recordedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    value: point.value,
  }))
  return (
    <div className="mt-3 overflow-hidden" data-testid="history-chart" aria-label={`History for ${title}`}>
      <LineChart width={220} height={88} data={data}>
        <CartesianGrid stroke="#e3dacb" vertical={false} />
        <XAxis dataKey="time" hide />
        <YAxis hide width={0} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#1d6b43"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
      <p className="text-xs text-muted-foreground">Last 24 hours</p>
    </div>
  )
}

function ActuatorRow({
  planterId,
  actuators,
}: {
  planterId: number
  actuators: Actuator[]
}) {
  const pumps = actuators.filter((actuator) => actuator.type === 'pump')
  const lamps = actuators.filter((actuator) => actuator.type === 'light')
  return (
    <div className="flex flex-col gap-3">
      {pumps.length === 0 && <p className="text-sm">Pump — no actuator on this pot</p>}
      {pumps.map((actuator) => (
        <ActuatorStateView key={actuator.id} planterId={planterId} label="Pump" actuator={actuator} />
      ))}
      {lamps.length === 0 && <p className="text-sm">Lamp — no actuator on this pot</p>}
      {lamps.map((actuator) => (
        <ActuatorStateView key={actuator.id} planterId={planterId} label="Lamp" actuator={actuator} />
      ))}
    </div>
  )
}

function ActuatorStateView({
  planterId,
  label,
  actuator,
}: {
  planterId: number
  label: string
  actuator: Actuator
}) {
  const on = actuator.desiredState === 'on'
  return (
    <div data-testid={`actuator-${planterId}-${actuator.type}`}>
      <p className="flex items-center gap-2 text-sm">
        <span>{label}</span>
        <Badge className={on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}>
          {actuator.desiredState}
        </Badge>
      </p>
      <p className="text-xs text-muted-foreground">
        Last reported {actuator.reportedState}. Not a device acknowledgement.
      </p>
    </div>
  )
}

function Recommendations({
  suggestions,
  approveAvailable,
  approvedIds,
  pendingId,
  approveError,
  onApprove,
}: {
  suggestions: Suggestion[]
  approveAvailable: boolean
  approvedIds: number[]
  pendingId: number | null
  approveError: string | null
  onApprove: (id: number) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!approveAvailable && <p>Approval is not on this API yet.</p>}
        {suggestions.length === 0 && <p>No pending recommendations.</p>}
        {suggestions.map((suggestion) => {
          const approved = approvedIds.includes(suggestion.id)
          return (
            <article key={suggestion.id} className="flex flex-col items-start gap-2">
              <p>{suggestion.summary}</p>
              {approveAvailable && !approved && (
                <Button
                  type="button"
                  onClick={() => {
                    onApprove(suggestion.id)
                  }}
                  disabled={pendingId === suggestion.id}
                >
                  Approve
                </Button>
              )}
              {approved && <p>Approved</p>}
            </article>
          )
        })}
        {approveError && <p>{approveError}</p>}
      </CardContent>
    </Card>
  )
}
