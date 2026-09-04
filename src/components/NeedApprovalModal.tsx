import { useEffect, useState } from 'react'
import type { LearnSuggestionDetail, QueuedActionSummary, LearnSuggestionSummary } from '../domain/vision'
import './NeedApprovalModal.css'

/** One row in the unified Need Approval list/modal — a real
 * `QueuedActionSummary` (Governed Action Bridge) or a real
 * `LearnSuggestionSummary` (new-domain Learn suggestion), never a
 * synthesized shared shape. Which real object is present is exactly what
 * decides which fields this modal shows and which resolve action it calls —
 * see `HudRightPanel.tsx`'s own `NeedApprovalCard` for where this is built. */
export type NeedApprovalItem =
  | { kind: 'action'; data: QueuedActionSummary }
  | { kind: 'learn'; data: LearnSuggestionSummary }

export function needApprovalItemId(item: NeedApprovalItem): string {
  return `${item.kind}:${item.data.id}`
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed)
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="need-approval-modal__field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

interface NeedApprovalModalProps {
  item: NeedApprovalItem
  busy: boolean
  /** The real error/rejection detail from this exact item's last resolve
   * attempt, if it failed — never fabricated; `null` whenever there's
   * nothing to show (no attempt yet, or the attempt is still in flight). */
  lastActionError: string | null
  fetchLearnDetail: (suggestionId: string) => Promise<LearnSuggestionDetail>
  onApprove: () => void
  onReject: () => void
  onClose: () => void
}

/** A true floating overlay (fixed over the whole viewport, own backdrop) —
 * deliberately NOT `CardDetailOverlay` (which replaces the center chat
 * panel via `HomeScreen`'s `activeDetail`/`centerDetail` slot, reserved for
 * the seven left-panel cards). This modal never touches that state, never
 * minimizes chat, and closes itself independently — a real modal dialog,
 * not a new navigation surface. */
export function NeedApprovalModal({ item, busy, lastActionError, fetchLearnDetail, onApprove, onReject, onClose }: NeedApprovalModalProps) {
  const [learnDetail, setLearnDetail] = useState<LearnSuggestionDetail | null>(null)
  const [learnDetailLoading, setLearnDetailLoading] = useState(false)

  useEffect(() => {
    if (item.kind !== 'learn') return
    setLearnDetail(null)
    setLearnDetailLoading(true)
    fetchLearnDetail(item.data.id)
      .then(setLearnDetail)
      .catch(() => {
        // A failed detail fetch just means the modal stays summary-only —
        // the real summary fields already shown are still enough to act on.
      })
      .finally(() => setLearnDetailLoading(false))
    // `item.data.id` (not the whole `item`) is the real re-fetch trigger —
    // a different approval selected while this modal is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.kind === 'learn' ? item.data.id : null])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const title = item.kind === 'action' ? 'Action Approval' : 'Learn Approval'
  const requestLabel = item.kind === 'action' ? 'Requested action' : 'Proposed domain'
  const requestValue = item.kind === 'action' ? item.data.task : item.data.domain ?? item.data.operation

  return (
    <div className="need-approval-modal-backdrop" onClick={onClose}>
      <div className="need-approval-modal" onClick={(event) => event.stopPropagation()}>
        <header className="need-approval-modal__header">
          <span>{title}</span>
          <button type="button" className="need-approval-modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="need-approval-modal__body">
          <Field label={requestLabel} value={requestValue} />

          {item.kind === 'action' ? (
            <>
              <Field label="Requested by" value={item.data.user_id} />
              <Field label="Action" value={item.data.action} />
              <Field label="Stage" value={item.data.stage} />
              <Field label="Detail" value={item.data.detail} />
              <Field label="Status" value={item.data.status} />
              <Field label="Requested at" value={formatTimestamp(item.data.created_at)} />
            </>
          ) : (
            <>
              <Field label="Requested by" value={item.data.requested_by} />
              <Field label="Source" value={item.data.source} />
              <Field label="Reason" value={item.data.reason} />
              {item.data.status === 'deferred' && <span className="need-approval-modal__badge">Deferred</span>}
              <Field label="Requested at" value={formatTimestamp(item.data.created_at)} />
              {learnDetailLoading && <span className="need-approval-modal__loading">Loading detail…</span>}
              {learnDetail && (
                <>
                  <Field label="Proposed skill" value={learnDetail.proposed.name ?? item.data.target_skill_id} />
                  {learnDetail.proposed.description && (
                    <p className="need-approval-modal__description">{learnDetail.proposed.description}</p>
                  )}
                  {learnDetail.proposed.prompt_fragment && (
                    <p className="need-approval-modal__fragment">{learnDetail.proposed.prompt_fragment}</p>
                  )}
                </>
              )}
            </>
          )}

          {lastActionError && <span className="need-approval-modal__error">{lastActionError}</span>}
        </div>
        <div className="need-approval-modal__actions">
          <button type="button" className="hud-pending-learn-row__approve" disabled={busy} onClick={onApprove}>
            {busy ? 'Working…' : 'Approve'}
          </button>
          <button type="button" className="hud-pending-learn-row__reject" disabled={busy} onClick={onReject}>
            {busy ? 'Working…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
