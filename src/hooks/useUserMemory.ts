import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import type { VisionApiAdapter } from '../adapters/vision'
import { VisionApiError } from '../adapters/vision'
import type { ConversationProfileResult, UserMemoriesResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchUserMemories = (api: VisionApiAdapter, signal: AbortSignal) => api.getUserMemories(signal)
const fetchConversationProfile = (api: VisionApiAdapter, signal: AbortSignal) => api.getConversationProfile(signal)

interface UseUserMemoryResult {
  memories: ReturnType<typeof useVisionResource<UserMemoriesResult>>
  profile: ReturnType<typeof useVisionResource<ConversationProfileResult>>
  /** The memory id currently mid-delete, or `'__profile__'` while the
   * Conversation Profile delete is in flight — disable that one row/action,
   * not the whole section. */
  pendingId: string | null
  /** Real result of the last delete (either kind) — cleared by the caller
   * before the next action, same convention `usePendingLearn` established. */
  lastResult: { targetId: string; ok: boolean; detail: string } | null
  deleteMemory: (memoryId: string) => void
  deleteProfile: () => void
}

const PROFILE_DELETE_ID = '__profile__'

/**
 * `GET /memory/user` + `GET /memory/profile`, plus their two real deletes
 * (`DELETE /memory/user/{id}`, `DELETE /memory/profile`) — what MAT actually
 * remembers about the caller (durable facts) and how it's learned to talk
 * to them (style), both dev/operator-inspectable and both erasable. Neither
 * route is polled (glance-and-load, same as `useMemoryStats`); each delete
 * refetches its own resource once the real outcome is known.
 */
export function useUserMemory(): UseUserMemoryResult {
  const api = useVisionApi()
  const memories = useVisionResource<UserMemoriesResult>(fetchUserMemories)
  const profile = useVisionResource<ConversationProfileResult>(fetchConversationProfile)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ targetId: string; ok: boolean; detail: string } | null>(null)

  const deleteMemory = (memoryId: string) => {
    setPendingId(memoryId)
    setLastResult(null)
    api
      .deleteUserMemory(memoryId)
      .then(() => {
        setLastResult({ targetId: memoryId, ok: true, detail: 'Deleted.' })
        memories.refetch()
      })
      .catch((err: unknown) => {
        setLastResult({ targetId: memoryId, ok: false, detail: err instanceof VisionApiError ? err.detail : 'Delete failed.' })
      })
      .finally(() => setPendingId(null))
  }

  const deleteProfile = () => {
    setPendingId(PROFILE_DELETE_ID)
    setLastResult(null)
    api
      .deleteConversationProfile()
      .then(() => {
        setLastResult({ targetId: PROFILE_DELETE_ID, ok: true, detail: 'Reset.' })
        profile.refetch()
      })
      .catch((err: unknown) => {
        setLastResult({ targetId: PROFILE_DELETE_ID, ok: false, detail: err instanceof VisionApiError ? err.detail : 'Reset failed.' })
      })
      .finally(() => setPendingId(null))
  }

  return { memories, profile, pendingId, lastResult, deleteMemory, deleteProfile }
}

export { PROFILE_DELETE_ID }
