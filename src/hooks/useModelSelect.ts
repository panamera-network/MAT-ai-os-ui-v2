import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import type { ModelSelectRequest } from '../domain/vision'

interface UseModelSelectResult {
  pending: boolean
  /** The real response's own outcome, restated from the request — never a
   * fabricated "saved". */
  lastResult: string | null
  select: (request: ModelSelectRequest, onSettled: () => void) => void
}

/** Real `POST /models/select` for the Glass HUD's minimal model-routing
 * form. Leaving `provider`/`model` empty clears that capability/tier slot —
 * the API's own semantics, not something invented here. */
export function useModelSelect(): UseModelSelectResult {
  const api = useVisionApi()
  const [pending, setPending] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const select = (request: ModelSelectRequest, onSettled: () => void) => {
    setPending(true)
    api
      .selectModel(request)
      .then(() => {
        const target = request.provider || request.model ? `${request.provider ?? ''} ${request.model ?? ''}`.trim() : 'cleared'
        setLastResult(`${request.capability} ${request.tier ?? 'primary'} → ${target}`)
      })
      .catch((err: unknown) => {
        setLastResult(err instanceof VisionApiError ? `Update failed: ${err.detail}` : 'Update failed')
      })
      .finally(() => {
        setPending(false)
        onSettled()
      })
  }

  return { pending, lastResult, select }
}
