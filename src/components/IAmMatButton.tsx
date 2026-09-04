import './IAmMatButton.css'

interface IAmMatButtonProps {
  active: boolean
  onClick: () => void
}

/**
 * Locked top placement (per spec): a standalone button ABOVE the Presence /
 * Brain View switcher, never a third option inside `CanvasSwitcher`'s own
 * tablist — "I AM MAT" is a different kind of thing ("inspect who MAT is")
 * from switching between the two canvas visualizations, so it gets its own
 * control, not a third tab. Purely a controlled toggle, same convention
 * `CanvasSwitcher` already uses: the real `view` state lives in `HomeScreen`.
 */
export function IAmMatButton({ active, onClick }: IAmMatButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`iammat-button${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      I AM MAT
    </button>
  )
}
