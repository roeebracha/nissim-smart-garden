import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createDemoClient } from '@/demo/fixtures'
import type { GardenClient } from '@/lib/types'
import { Dashboard } from './dashboard'

function client(overrides: Partial<GardenClient> = {}): GardenClient {
  return { ...createDemoClient(), ...overrides }
}

describe('Dashboard', () => {
  it('renders two pots, readings, a chart, actuator badges, and an approve button', async () => {
    render(<Dashboard client={client()} />)

    expect(await screen.findByRole('heading', { name: 'Tea' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Peppers' })).toBeInTheDocument()
    for (const title of ['Temperature', 'Humidity', 'Light', 'Water level', 'Soil moisture']) {
      expect(screen.getAllByText(title).length).toBeGreaterThanOrEqual(2)
    }
    expect(screen.getAllByText(/SHT31/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/BH1750/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/Tank float/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('24.2 °C')).toBeInTheDocument()
    expect(screen.getByText('Has water')).toBeInTheDocument()
    expect(screen.getByText('Empty')).toBeInTheDocument()
    expect(screen.getAllByTestId('history-chart').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pump').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Lamp').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Not a device acknowledgement/).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Lower the tea moisture on-threshold to 30/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
  })

  it('hides the approve button when that route is absent', async () => {
    render(
      <Dashboard
        client={client({
          async getSuggestions() {
            return {
              suggestions: [
                {
                  id: 7,
                  summary: 'Leave the threshold alone.',
                  planterId: 1,
                  sensorType: 'moisture',
                  actuatorType: 'pump',
                  status: 'pending',
                },
              ],
              approveAvailable: false,
            }
          },
        })}
      />,
    )

    expect(await screen.findByText('Leave the threshold alone.')).toBeInTheDocument()
    expect(screen.getByText('Approval is not on this API yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('shows an empty recommendation list when suggestions are missing', async () => {
    render(
      <Dashboard
        client={client({
          async getSuggestions() {
            return { suggestions: [], approveAvailable: false }
          },
        })}
      />,
    )

    expect(await screen.findByText('No pending recommendations.')).toBeInTheDocument()
    expect(screen.getByText('Approval is not on this API yet.')).toBeInTheDocument()
  })

  it('sends approval through the client and not through MQTT', async () => {
    const approve = vi.fn(async () => {})
    const user = userEvent.setup()
    render(<Dashboard client={client({ approve })} />)

    await user.click(await screen.findByRole('button', { name: 'Approve' }))
    expect(approve).toHaveBeenCalledWith(7)
    expect(await screen.findByText('Approved')).toBeInTheDocument()
  })
})
