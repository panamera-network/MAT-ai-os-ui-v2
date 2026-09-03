import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RestVisionApiAdapter } from './RestVisionApiAdapter'
import { VisionApiError } from './errors'

/**
 * Implement #13A: adapter coverage for every method added this pass —
 * MCP approve/deny, Governed Action Queue, Loop actions, Skill rollback,
 * and the two user-memory deletes. Mocks `global.fetch` directly (no
 * server) — same technique every other adapter test in this repo would
 * use; this is the first adapter test file, so the pattern is established
 * here for future ones to follow.
 */
describe('RestVisionApiAdapter — Implement #13A new methods', () => {
  const baseUrl = 'http://127.0.0.1:8000'
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }

  function emptyResponse(status = 204): Response {
    return new Response(null, { status })
  }

  function adapter(): RestVisionApiAdapter {
    return new RestVisionApiAdapter({ baseUrl })
  }

  it('approveMcpApproval POSTs to /mcp/approvals/{id}/approve', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ approval: { id: 'a1', status: 'approved' } }))
    const result = await adapter().approveMcpApproval('a1')
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/mcp/approvals/a1/approve`, expect.objectContaining({ method: 'POST' }))
    expect(result.approval.status).toBe('approved')
  })

  it('denyMcpApproval POSTs with an optional reason query param', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ approval: { id: 'a1', status: 'denied' } }))
    await adapter().denyMcpApproval('a1', 'not needed')
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/mcp/approvals/a1/deny?reason=not%20needed`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('denyMcpApproval omits the query string when no reason is given', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ approval: { id: 'a1', status: 'denied' } }))
    await adapter().denyMcpApproval('a1')
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/mcp/approvals/a1/deny`, expect.objectContaining({ method: 'POST' }))
  })

  it('getPendingApprovalQueue GETs /queue/pending-approval', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }))
    const result = await adapter().getPendingApprovalQueue()
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/queue/pending-approval`, expect.anything())
    expect(result.items).toEqual([])
  })

  it('getPendingApprovalTask GETs /queue/pending-approval/{id}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 't1', status: 'pending_approval' }))
    await adapter().getPendingApprovalTask('t1')
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/queue/pending-approval/t1`, expect.anything())
  })

  it('approvePendingApprovalTask POSTs .../approve', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 't1', status: 'completed' }))
    const result = await adapter().approvePendingApprovalTask('t1')
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/queue/pending-approval/t1/approve`, expect.objectContaining({ method: 'POST' }))
    expect(result.status).toBe('completed')
  })

  it('rejectPendingApprovalTask POSTs .../reject', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 't1', status: 'rejected' }))
    const result = await adapter().rejectPendingApprovalTask('t1')
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/queue/pending-approval/t1/reject`, expect.objectContaining({ method: 'POST' }))
    expect(result.status).toBe('rejected')
  })

  it('getLoop GETs /loops/{id}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ loop: { id: 'l1', status: 'active' } }))
    await adapter().getLoop('l1')
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/loops/l1`, expect.anything())
  })

  it('pauseLoop/startLoop POST to their own routes', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ loop: { id: 'l1', status: 'paused' } })))
    await adapter().pauseLoop('l1')
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/loops/l1/pause`, expect.objectContaining({ method: 'POST' }))
    await adapter().startLoop('l1')
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/loops/l1/start`, expect.objectContaining({ method: 'POST' }))
  })

  it('runLoopNow POSTs /loops/{id}/run-now and returns the real outcome', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ loop: { id: 'l1' }, outcome: 'skipped_already_running' }))
    const result = await adapter().runLoopNow('l1')
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/loops/l1/run-now`, expect.objectContaining({ method: 'POST' }))
    expect(result.outcome).toBe('skipped_already_running')
  })

  it('rollbackSkill POSTs /skills/{id}/rollback', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ skill: { id: 's1' } }))
    await adapter().rollbackSkill('s1')
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/skills/s1/rollback`, expect.objectContaining({ method: 'POST' }))
  })

  it('getUserMemories GETs /memory/user', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ body_attached: true, memories: [] }))
    await adapter().getUserMemories()
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/memory/user`, expect.anything())
  })

  it('deleteUserMemory DELETEs /memory/user/{id} and resolves on 204 (no body to parse)', async () => {
    fetchMock.mockResolvedValue(emptyResponse(204))
    await expect(adapter().deleteUserMemory('m1')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/memory/user/m1`, expect.objectContaining({ method: 'DELETE' }))
  })

  it('deleteUserMemory rejects with VisionApiError on a real error status', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Memory not found.' }, 404))
    await expect(adapter().deleteUserMemory('missing')).rejects.toBeInstanceOf(VisionApiError)
  })

  it('getConversationProfile GETs /memory/profile', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ body_attached: true, exists: false, dimensions: {} }))
    const result = await adapter().getConversationProfile()
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/memory/profile`, expect.anything())
    expect(result.exists).toBe(false)
  })

  it('deleteConversationProfile DELETEs /memory/profile and resolves on 204', async () => {
    fetchMock.mockResolvedValue(emptyResponse(204))
    await expect(adapter().deleteConversationProfile()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/memory/profile`, expect.objectContaining({ method: 'DELETE' }))
  })

  it('a 204 route surfaces a network failure the same honest way requestJson does', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await adapter().deleteUserMemory('m1').catch((err: unknown) => err)
    expect(error).toBeInstanceOf(VisionApiError)
    expect((error as VisionApiError).unreachable).toBe(true)
  })
})
