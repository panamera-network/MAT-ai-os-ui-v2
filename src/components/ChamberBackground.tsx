import './ChamberBackground.css'

// LOCKED — approved after several rounds of visual tuning (density, depth,
// rear wall mesh, color palette, glow shape, streak/node motion). Treat any
// further restyling here as a deliberate, explicit request, not a
// side-effect of unrelated work.

const VIEW_W = 1000
const VIEW_H = 600
const VP_X = VIEW_W / 2
const VP_Y = VIEW_H / 2

// The near "mouth" of the chamber — where floor/ceiling/walls meet the
// front edge of the visible scene.
const FRONT_LEFT = 30
const FRONT_RIGHT = VIEW_W - 30
const FRONT_TOP = 20
const FRONT_BOTTOM = VIEW_H - 20

const RADIAL_DIVISIONS = 10
const CROSS_STEPS = 10

// The rear wall's distance in world-space depth units (see MAX_WORLD_DEPTH
// below for how this maps to screen space) — was 2, now 20% shallower so
// the rear wall sits noticeably closer. Mesh count (RADIAL_DIVISIONS,
// CROSS_STEPS) is unchanged; only how much room those same lines subdivide.
const ROOM_WORLD_DEPTH = 2 * 0.8
const REAR_T = 1 / (1 + ROOM_WORLD_DEPTH)

// An even grid drawn directly on the rear wall's own flat rectangle —
// distinct from the cross-rings, which stop at that rectangle's edge but
// never fill it in. Matches RADIAL_DIVISIONS/CROSS_STEPS so the rear wall's
// own mesh reads at the same density as the floor and side walls.
const REAR_WALL_DIVISIONS = 10

// Every 4th depth line carries a traveling light streak — sparse enough to
// read as "a few strands are alive," not a strobing grid.
const STREAK_STEP = 4
const STREAK_OFFSET = 1

// Two rings of pulsing nodes, two positions per surface each — a scattered
// handful of glowing points, not one at every intersection.
const NODE_DEPTH_INDEXES = [2, 6]
const NODE_EDGE_TS = [0.25, 0.75]

// Exactly two full-loop ring streaks — one clockwise, one counter-clockwise
// — deliberately not one per ring. A loop streak reads very differently
// from a radial one (it visibly circles the tunnel rather than travels its
// depth), so a couple is plenty; more would stop reading as "a couple of
// strands are alive" and start reading as a spinning graphic.
const RING_STREAK_DEPTH_INDEXES = [1, 5]

interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface CrossLine {
  line: Line
  t: number
}

interface Node {
  x: number
  y: number
  delay: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Evenly spaced in world-space depth (real, equal-sized divisions of the
 * room), from the front edge (t = 1) to the rear wall (t = REAR_T, exactly
 * `ROOM_WORLD_DEPTH` away). Screen spacing still compresses naturally
 * toward the back — that compression is what reads as "receding in 3D"
 * rather than flat nested rectangles; pure even *screen*-space spacing was
 * tried and lost that cue entirely.
 */
function depthSteps(steps: number): number[] {
  return Array.from({ length: steps }, (_, i) => {
    const worldDepth = (i / (steps - 1)) * ROOM_WORLD_DEPTH
    return 1 / (1 + worldDepth)
  })
}

/** Cross-ring opacity relative to the radial (depth) lines' own base
 * opacity — capped well under 1 even at the front edge. Ten full rings is
 * enough solid rectangles that, at equal weight to the radial lines, they
 * read as "nested boxes" rather than "a floor/wall/ceiling receding" — the
 * radial lines are what actually sell the 3D read, so the rings stay
 * secondary to them at every depth, fading further still toward the back. */
function depthOpacity(t: number): number {
  const depthFactor = (t - REAR_T) / (1 - REAR_T)
  return lerp(0.22, 0.55, depthFactor)
}

/** A point on a horizontal surface (floor/ceiling): `edgeT` sweeps left-to-right,
 * `depthT` sweeps front (1) to the rear wall (`REAR_T`) — never all the way to
 * the vanishing point. */
function horizontalSurfacePoint(depthT: number, edgeT: number, fixedY: number): [number, number] {
  const x = lerp(VP_X, lerp(FRONT_LEFT, FRONT_RIGHT, edgeT), depthT)
  const y = lerp(VP_Y, fixedY, depthT)
  return [x, y]
}

/** A point on a vertical surface (left/right wall): `edgeT` sweeps top-to-bottom,
 * `depthT` sweeps front (1) to the rear wall (`REAR_T`). */
function verticalSurfacePoint(depthT: number, edgeT: number, fixedX: number): [number, number] {
  const x = lerp(VP_X, fixedX, depthT)
  const y = lerp(VP_Y, lerp(FRONT_TOP, FRONT_BOTTOM, edgeT), depthT)
  return [x, y]
}

/** The closed rectangular path traced by one depth ring — the same four
 * corners the floor/ceiling/wall cross-lines already meet at, walked
 * top-left → top-right → bottom-right → bottom-left → close. That winding
 * order is what "clockwise" means below; reversing the dash animation's
 * direction (not the path itself) gives counter-clockwise for free. */
function ringPath(t: number): string {
  const tl = horizontalSurfacePoint(t, 0, FRONT_TOP)
  const tr = horizontalSurfacePoint(t, 1, FRONT_TOP)
  const br = horizontalSurfacePoint(t, 1, FRONT_BOTTOM)
  const bl = horizontalSurfacePoint(t, 0, FRONT_BOTTOM)
  return `M ${tl[0]} ${tl[1]} L ${tr[0]} ${tr[1]} L ${br[0]} ${br[1]} L ${bl[0]} ${bl[1]} Z`
}

interface Surface {
  radial: Line[]
  cross: CrossLine[]
}

function horizontalSurface(fixedY: number): Surface {
  const radial: Line[] = []
  for (let i = 0; i <= RADIAL_DIVISIONS; i++) {
    const edgeT = i / RADIAL_DIVISIONS
    const [xNear, yNear] = horizontalSurfacePoint(1, edgeT, fixedY)
    const [xFar, yFar] = horizontalSurfacePoint(REAR_T, edgeT, fixedY)
    radial.push({ x1: xNear, y1: yNear, x2: xFar, y2: yFar })
  }
  const cross = depthSteps(CROSS_STEPS).map((t) => {
    const [xLeft, y] = horizontalSurfacePoint(t, 0, fixedY)
    const [xRight] = horizontalSurfacePoint(t, 1, fixedY)
    return { line: { x1: xLeft, y1: y, x2: xRight, y2: y }, t }
  })
  return { radial, cross }
}

function verticalSurface(fixedX: number): Surface {
  const radial: Line[] = []
  for (let i = 0; i <= RADIAL_DIVISIONS; i++) {
    const edgeT = i / RADIAL_DIVISIONS
    const [xNear, yNear] = verticalSurfacePoint(1, edgeT, fixedX)
    const [xFar, yFar] = verticalSurfacePoint(REAR_T, edgeT, fixedX)
    radial.push({ x1: xNear, y1: yNear, x2: xFar, y2: yFar })
  }
  const cross = depthSteps(CROSS_STEPS).map((t) => {
    const [x, yTop] = verticalSurfacePoint(t, 0, fixedX)
    const [, yBottom] = verticalSurfacePoint(t, 1, fixedX)
    return { line: { x1: x, y1: yTop, x2: x, y2: yBottom }, t }
  })
  return { radial, cross }
}

/** An even grid filling the rear wall's own flat rectangle — the cross-rings
 * from each surface already trace that rectangle's outline (see
 * horizontalSurface()/verticalSurface()), but never fill it in. */
function rearWallLines(): Line[] {
  const left = lerp(VP_X, FRONT_LEFT, REAR_T)
  const right = lerp(VP_X, FRONT_RIGHT, REAR_T)
  const top = lerp(VP_Y, FRONT_TOP, REAR_T)
  const bottom = lerp(VP_Y, FRONT_BOTTOM, REAR_T)

  const lines: Line[] = []
  for (let i = 1; i < REAR_WALL_DIVISIONS; i++) {
    const x = lerp(left, right, i / REAR_WALL_DIVISIONS)
    lines.push({ x1: x, y1: top, x2: x, y2: bottom })
  }
  for (let i = 1; i < REAR_WALL_DIVISIONS; i++) {
    const y = lerp(top, bottom, i / REAR_WALL_DIVISIONS)
    lines.push({ x1: left, y1: y, x2: right, y2: y })
  }
  return lines
}

/** Two nodes on one surface's rear-ish cross-ring — `sample` picks the
 * surface (floor/ceiling/left wall/right wall), `delayStart` staggers this
 * surface's pair against the others so all eight don't pulse in lockstep. */
function surfaceNodes(sample: (edgeT: number) => [number, number], delayStart: number): Node[] {
  return NODE_EDGE_TS.map((edgeT, i) => {
    const [x, y] = sample(edgeT)
    return { x, y, delay: delayStart + i * 0.6 }
  })
}

function buildNodes(): Node[] {
  const steps = depthSteps(CROSS_STEPS)
  return NODE_DEPTH_INDEXES.flatMap((depthIndex, ring) => {
    const t = steps[depthIndex]
    const ringDelay = ring * 0.9
    return [
      ...surfaceNodes((edgeT) => horizontalSurfacePoint(t, edgeT, FRONT_BOTTOM), ringDelay),
      ...surfaceNodes((edgeT) => horizontalSurfacePoint(t, edgeT, FRONT_TOP), ringDelay + 0.4),
      ...surfaceNodes((edgeT) => verticalSurfacePoint(t, edgeT, FRONT_LEFT), ringDelay + 0.8),
      ...surfaceNodes((edgeT) => verticalSurfacePoint(t, edgeT, FRONT_RIGHT), ringDelay + 1.2),
    ]
  })
}

function renderRadialLines(lines: Line[], keyPrefix: string) {
  return lines.map((line, i) => (
    <g key={`${keyPrefix}-${i}`}>
      <line {...line} />
      {i % STREAK_STEP === STREAK_OFFSET && (
        <line {...line} pathLength={100} className="chamber-background__streak" style={{ animationDelay: `${(i * 0.35) % 3.4}s` }} />
      )}
    </g>
  ))
}

function renderCrossLines(lines: CrossLine[], keyPrefix: string) {
  // A distinct, cooler color from the radial (edge) lines — that hue
  // separation is what keeps ten full-width rings reading as "a fine floor/
  // wall/ceiling mesh" rather than "nested boxes": the bold red edges carry
  // the room's structure, this fine cyan grid is just texture on top of it.
  return lines.map(({ line, t }, i) => (
    <line key={`${keyPrefix}-${i}`} {...line} className="chamber-background__cross" style={{ opacity: depthOpacity(t) }} />
  ))
}

/**
 * A minimal one-point-perspective wireframe chamber — floor, ceiling, two
 * walls, closed off by a rear wall rather than a tunnel receding to
 * infinity, the rear wall carrying its own grid at the same density as the
 * floor and side walls. Purple structural edges (the radial depth lines)
 * carry the room's shape; a fine cyan mesh (the cross-rings and the rear
 * wall's grid) sits on top as texture; a handful of small "alive" cues
 * layer over both — sharp light streaks riding a few of the edges, two full
 * ring streaks looping the tunnel (one clockwise, one counter-clockwise),
 * softly pulsing nodes scattered at two depths, and a curved glow bulging
 * in from both walls. Purple here (`--chamber-edge`/`--chamber-glow`) is
 * the app's own `--hud-accent`, not a separate color choice — still pure
 * background: no presence, no status, no data of its own, decorative and
 * inert (`aria-hidden`, no pointer events), painted behind everything
 * `AppShell` renders on top of it.
 */
export function ChamberBackground() {
  const floor = horizontalSurface(FRONT_BOTTOM)
  const ceiling = horizontalSurface(FRONT_TOP)
  const leftWall = verticalSurface(FRONT_LEFT)
  const rightWall = verticalSurface(FRONT_RIGHT)
  const nodes = buildNodes()
  const ringSteps = depthSteps(CROSS_STEPS)
  const ringStreakPaths = RING_STREAK_DEPTH_INDEXES.map((i) => ringPath(ringSteps[i]))

  return (
    <svg className="chamber-background" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        {/* Default cx/cy/r (50%/50%/50%) is exactly right here — it centers
            each gradient on its ellipse's own true center, which sits
            exactly on the screen edge (see the `cx={0}`/`cx={VIEW_W}` on
            the ellipses below), so the glow is brightest right at the edge
            and fades out toward the ellipse's visible inner curve. */}
        <radialGradient id="chamber-glow-left">
          <stop offset="0%" stopColor="var(--chamber-glow)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--chamber-glow)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="chamber-glow-right">
          <stop offset="0%" stopColor="var(--chamber-glow)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--chamber-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Navy backdrop, scoped to the chamber only — replaces the app's own
          purple ambient wash within this area so the palette below doesn't
          sit on top of a clashing tint. */}
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="var(--chamber-void)" />

      {/* Side glow — a curved wash bulging in from each wall, not a flat
          rectangular block. Each ellipse is centered ON the screen edge, so
          only its inner half is ever visible; that visible half's curve is
          what gives the glow its rounded inner boundary. */}
      <ellipse cx="0" cy={VIEW_H / 2} rx={VIEW_W * 0.16} ry={VIEW_H * 0.62} fill="url(#chamber-glow-left)" className="chamber-background__side-glow" />
      <ellipse
        cx={VIEW_W}
        cy={VIEW_H / 2}
        rx={VIEW_W * 0.16}
        ry={VIEW_H * 0.62}
        fill="url(#chamber-glow-right)"
        className="chamber-background__side-glow"
      />

      <g className="chamber-background__surface chamber-background__surface--wall">
        {renderRadialLines(leftWall.radial, 'lw-r')}
        {renderRadialLines(rightWall.radial, 'rw-r')}
        {renderCrossLines(leftWall.cross, 'lw-c')}
        {renderCrossLines(rightWall.cross, 'rw-c')}
      </g>

      <g className="chamber-background__surface chamber-background__surface--ceiling">
        {renderRadialLines(ceiling.radial, 'c-r')}
        {renderCrossLines(ceiling.cross, 'c-c')}
      </g>

      <g className="chamber-background__surface chamber-background__surface--floor">
        {renderRadialLines(floor.radial, 'f-r')}
        {renderCrossLines(floor.cross, 'f-c')}
      </g>

      <g className="chamber-background__surface chamber-background__surface--rear">
        {rearWallLines().map((line, i) => (
          <line key={`rear-${i}`} className="chamber-background__cross" {...line} />
        ))}
      </g>

      {/* Two full loop streaks — one clockwise, one counter-clockwise —
          tracing a ring's own four corners rather than a single line. */}
      <path d={ringStreakPaths[0]} pathLength={100} className="chamber-background__ring-streak chamber-background__ring-streak--cw" />
      <path d={ringStreakPaths[1]} pathLength={100} className="chamber-background__ring-streak chamber-background__ring-streak--ccw" />

      {nodes.map((node, i) => (
        <circle key={`node-${i}`} cx={node.x} cy={node.y} r={1.8} className="chamber-background__node" style={{ animationDelay: `${node.delay}s` }} />
      ))}
    </svg>
  )
}
