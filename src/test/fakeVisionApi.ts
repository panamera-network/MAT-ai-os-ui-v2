import { vi } from 'vitest'
import type { Mocked } from 'vitest'
import type { VisionApiAdapter } from '../adapters/vision'

/**
 * A fully-typed fake `VisionApiAdapter` for hook/component tests — every
 * method is a `vi.fn()` a test can configure per-case (`mockResolvedValue`/
 * `mockRejectedValue`), never a real network call. Kept in one shared place
 * so every test file's fake stays in sync with the real interface (a
 * missing method here is a compile error, not a silently-passing test).
 * `Mocked<T>` (vitest's own utility type) — not a hand-rolled intersection
 * — is what actually gives each property both its real call signature AND
 * `mockResolvedValue`/`mockRejectedValue`/`.mock` at the type level.
 */
export function createFakeVisionApi(): Mocked<VisionApiAdapter> {
  return {
    getHealth: vi.fn(),
    think: vi.fn(),
    see: vi.fn(),
    readDocument: vi.fn(),
    listen: vi.fn(),
    speak: vi.fn(),
    learn: vi.fn(),
    getPendingLearnSuggestions: vi.fn(),
    getLearnSuggestion: vi.fn(),
    approveLearnSuggestion: vi.fn(),
    rejectLearnSuggestion: vi.fn(),

    getSoul: vi.fn(),
    getIdentity: vi.fn(),

    getControlStatus: vi.fn(),
    startBody: vi.fn(),
    stopBody: vi.fn(),
    restartBody: vi.fn(),
    killBody: vi.fn(),
    checkWatchdog: vi.fn(),

    getAgents: vi.fn(),
    getLoops: vi.fn(),
    getLoop: vi.fn(),
    pauseLoop: vi.fn(),
    startLoop: vi.fn(),
    runLoopNow: vi.fn(),
    getEvents: vi.fn(),
    getMemory: vi.fn(),
    getUserMemories: vi.fn(),
    deleteUserMemory: vi.fn(),
    getConversationProfile: vi.fn(),
    deleteConversationProfile: vi.fn(),
    getGovernance: vi.fn(),
    getMcp: vi.fn(),
    approveMcpApproval: vi.fn(),
    denyMcpApproval: vi.fn(),
    getSkills: vi.fn(),
    getSkillVersions: vi.fn(),
    rollbackSkill: vi.fn(),
    getKnowledge: vi.fn(),
    getKnowledgeItem: vi.fn(),
    promoteKnowledge: vi.fn(),

    getPendingApprovalQueue: vi.fn(),
    getPendingApprovalTask: vi.fn(),
    approvePendingApprovalTask: vi.fn(),
    rejectPendingApprovalTask: vi.fn(),

    getModels: vi.fn(),
    selectModel: vi.fn(),
    getBudget: vi.fn(),

    getServices: vi.fn(),
    getService: vi.fn(),
    startService: vi.fn(),
    stopService: vi.fn(),
    restartService: vi.fn(),
  }
}
