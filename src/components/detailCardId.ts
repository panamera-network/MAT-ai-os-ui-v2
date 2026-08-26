/** Which left-panel card's detail overlay (if any) is open — the one piece
 * of state `HomeScreen` shares between `HudLeftPanel` (click source) and
 * `CardDetailOverlay` (renders in the center canvas cell). Small shared type
 * file, same pattern as `hudEvents.ts`, so neither component needs to import
 * from the other just for this. */
export type DetailCardId = 'agents' | 'loops' | 'models' | 'governance' | 'mcp' | 'skills'
