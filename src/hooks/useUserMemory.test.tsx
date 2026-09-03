import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { VisionApiProvider } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import { createFakeVisionApi } from '../test/fakeVisionApi'
import { PROFILE_DELETE_ID, useUserMemory } from './useUserMemory'

function wrapper(api: ReturnType<typeof createFakeVisionApi>) {
  return ({ children }: { children: ReactNode }) => <VisionApiProvider adapter={api}>{children}</VisionApiProvider>
}

describe('useUserMemory', () => {
  it('loads the real user-memory list and Conversation Profile', async () => {
    const api = createFakeVisionApi()
    api.getUserMemories.mockResolvedValue({
      body_attached: true,
      memories: [{ id: 'm1', content: 'Prefers dark mode', metadata: {}, created_at: '2026-09-01T00:00:00Z' }],
    })
    api.getConversationProfile.mockResolvedValue({
      body_attached: true,
      exists: true,
      dimensions: { tone: { value: 'concise', confidence: 0.9, evidence_count: 4, source: 'inferred', last_updated: '2026-09-01T00:00:00Z' } },
    })
    const { result } = renderHook(() => useUserMemory(), { wrapper: wrapper(api) })

    await waitFor(() => expect(result.current.memories.loading).toBe(false))
    await waitFor(() => expect(result.current.profile.loading).toBe(false))
    expect(result.current.memories.data?.memories).toHaveLength(1)
    expect(result.current.profile.data?.dimensions.tone.value).toBe('concise')
  })

  it('deleteMemory calls the real delete route and refetches the list', async () => {
    const api = createFakeVisionApi()
    api.getUserMemories.mockResolvedValue({ body_attached: true, memories: [] })
    api.getConversationProfile.mockResolvedValue({ body_attached: true, exists: false, dimensions: {} })
    api.deleteUserMemory.mockResolvedValue(undefined)
    const { result } = renderHook(() => useUserMemory(), { wrapper: wrapper(api) })
    await waitFor(() => expect(result.current.memories.loading).toBe(false))

    const callsBefore = api.getUserMemories.mock.calls.length
    act(() => result.current.deleteMemory('m1'))
    await waitFor(() => expect(result.current.lastResult?.ok).toBe(true))
    expect(api.deleteUserMemory).toHaveBeenCalledWith('m1')
    expect(api.getUserMemories.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('deleteProfile calls the real reset route, tagged with the profile sentinel id', async () => {
    const api = createFakeVisionApi()
    api.getUserMemories.mockResolvedValue({ body_attached: true, memories: [] })
    api.getConversationProfile.mockResolvedValue({ body_attached: true, exists: true, dimensions: {} })
    api.deleteConversationProfile.mockResolvedValue(undefined)
    const { result } = renderHook(() => useUserMemory(), { wrapper: wrapper(api) })
    await waitFor(() => expect(result.current.profile.loading).toBe(false))

    act(() => result.current.deleteProfile())
    await waitFor(() => expect(result.current.lastResult?.targetId).toBe(PROFILE_DELETE_ID))
    expect(result.current.lastResult?.ok).toBe(true)
    expect(api.deleteConversationProfile).toHaveBeenCalled()
  })

  it('a failed delete reports the real error, never a fabricated success', async () => {
    const api = createFakeVisionApi()
    api.getUserMemories.mockResolvedValue({ body_attached: true, memories: [] })
    api.getConversationProfile.mockResolvedValue({ body_attached: true, exists: false, dimensions: {} })
    api.deleteUserMemory.mockRejectedValue(new VisionApiError('boom', { status: 404, detail: 'Memory not found.' }))
    const { result } = renderHook(() => useUserMemory(), { wrapper: wrapper(api) })
    await waitFor(() => expect(result.current.memories.loading).toBe(false))

    act(() => result.current.deleteMemory('missing'))
    await waitFor(() => expect(result.current.lastResult?.ok).toBe(false))
    expect(result.current.lastResult?.detail).toBe('Memory not found.')
  })
})
