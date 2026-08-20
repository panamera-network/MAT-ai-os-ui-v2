import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { RestVisionApiAdapter, type VisionApiAdapter } from '../adapters/vision'

const VisionApiContext = createContext<VisionApiAdapter | null>(null)

interface VisionApiProviderProps {
  children: ReactNode
  /** Inject a different adapter (e.g. a future fixture-driven mock) — defaults
   * to the real REST adapter. Screens never construct an adapter themselves. */
  adapter?: VisionApiAdapter
}

export function VisionApiProvider({ children, adapter }: VisionApiProviderProps) {
  const value = useMemo(() => adapter ?? new RestVisionApiAdapter(), [adapter])
  return <VisionApiContext.Provider value={value}>{children}</VisionApiContext.Provider>
}

export function useVisionApi(): VisionApiAdapter {
  const adapter = useContext(VisionApiContext)
  if (!adapter) throw new Error('useVisionApi() must be called within a <VisionApiProvider>')
  return adapter
}
