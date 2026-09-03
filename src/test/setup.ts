import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// `test.globals` is off in vite.config.ts (every test file imports `describe`/
// `it`/`afterEach` explicitly from 'vitest') -- @testing-library/react's own
// auto-cleanup only registers itself when it finds a GLOBAL `afterEach`, so
// without this it never runs and every `render()` across a file's tests piles
// up in the same `document.body`, breaking `getByRole`/`findByRole` once more
// than one render matches the same role+name (Implement #13A: found via a
// `HudRightPanel` test file where every test after the first started timing
// out on an ambiguous multi-match, not a real bug in the component itself).
afterEach(() => {
  cleanup()
})
