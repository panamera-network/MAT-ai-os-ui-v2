import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { VisionApiProvider } from '../app/VisionApiProvider'
import { createFakeVisionApi } from '../test/fakeVisionApi'
import { HudRightPanel } from './HudRightPanel'

/** Every hook `HudRightPanel` mounts needs *something* to resolve to, or
 * the component just sits in a permanent loading state and the buttons
 * under test never get a chance to matter. None of these values are
 * asserted on here — they exist purely so the confirmation-guard tests
 * below have a real, rendered "Restart"/"Force Kill" button to click. */
function baselineApi() {
  const api = createFakeVisionApi()
  api.getServices.mockResolvedValue({ services: [] })
  api.getMemory.mockResolvedValue({ body_attached: false, tiers: {}, health: { module_ready: false, qdrant: 'unknown', vector_store_connected: false } })
  api.getUserMemories.mockResolvedValue({ body_attached: false, memories: [] })
  api.getConversationProfile.mockResolvedValue({ body_attached: false, exists: false, dimensions: {} })
  api.getEvents.mockResolvedValue({ body_attached: false, events: [] })
  api.getPendingLearnSuggestions.mockResolvedValue({ suggestions: [] })
  api.getPendingApprovalQueue.mockResolvedValue({ items: [] })
  api.startBody.mockResolvedValue({ result: { action: 'start', status: 'started' } })
  api.stopBody.mockResolvedValue({ result: { action: 'stop', status: 'stopped' } })
  api.restartBody.mockResolvedValue({ result: { action: 'restart', stop: { action: 'stop', status: 'stopped' }, start: { action: 'start', status: 'started' } } })
  api.killBody.mockResolvedValue({ result: { action: 'kill', status: 'stopped', forced: false } })
  api.checkWatchdog.mockResolvedValue({ result: { healthy: true, action: 'none' } })
  return api
}

function renderPanel(api: ReturnType<typeof createFakeVisionApi>) {
  return render(
    <VisionApiProvider adapter={api}>
      <HudRightPanel events={[]} onEvent={() => {}} />
    </VisionApiProvider>,
  )
}

describe('HudRightPanel — Implement #13A control safety', () => {
  let confirmSpy: MockInstance<typeof window.confirm>

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm')
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  it('Force Kill asks for confirmation before calling the real kill route', async () => {
    confirmSpy.mockReturnValue(false)
    const api = baselineApi()
    renderPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: /force kill/i }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(api.killBody).not.toHaveBeenCalled()
  })

  it('Force Kill proceeds once the operator confirms', async () => {
    confirmSpy.mockReturnValue(true)
    const api = baselineApi()
    renderPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: /force kill/i }))
    await waitFor(() => expect(api.killBody).toHaveBeenCalled())
  })

  it('Restart asks for confirmation before calling the real restart route', async () => {
    confirmSpy.mockReturnValue(false)
    const api = baselineApi()
    renderPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: /^restart$/i }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(api.restartBody).not.toHaveBeenCalled()
  })

  it('Restart proceeds once the operator confirms', async () => {
    confirmSpy.mockReturnValue(true)
    const api = baselineApi()
    renderPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: /^restart$/i }))
    await waitFor(() => expect(api.restartBody).toHaveBeenCalled())
  })

  it('Watchdog fires without any confirmation (never a destructive action)', async () => {
    const api = baselineApi()
    renderPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: /watchdog/i }))
    await waitFor(() => expect(api.checkWatchdog).toHaveBeenCalled())
    expect(confirmSpy).not.toHaveBeenCalled()
  })
})

describe('HudRightPanel — user memory delete confirmation', () => {
  let confirmSpy: MockInstance<typeof window.confirm>

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm')
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  it('deleting a user memory asks for confirmation first', async () => {
    confirmSpy.mockReturnValue(false)
    const api = baselineApi()
    api.getUserMemories.mockResolvedValue({
      body_attached: true,
      memories: [{ id: 'm1', content: 'Prefers dark mode', metadata: {}, created_at: null }],
    })
    renderPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: /view your memory/i }, { timeout: 5000 }))
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }, { timeout: 5000 }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(api.deleteUserMemory).not.toHaveBeenCalled()
  })

  it('confirming deletes the real memory and refetches the list', async () => {
    confirmSpy.mockReturnValue(true)
    const api = baselineApi()
    api.getUserMemories.mockResolvedValue({
      body_attached: true,
      memories: [{ id: 'm1', content: 'Prefers dark mode', metadata: {}, created_at: null }],
    })
    api.deleteUserMemory.mockResolvedValue(undefined)
    renderPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: /view your memory/i }, { timeout: 5000 }))
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }, { timeout: 5000 }))
    await waitFor(() => expect(api.deleteUserMemory).toHaveBeenCalledWith('m1'))
  })
})
