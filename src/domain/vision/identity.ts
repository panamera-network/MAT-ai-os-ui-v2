/** One of the four fixed workspace personas — validated server-side against
 * this exact set (`iammat/soul/content.py::PERSONAS`). */
export const PERSONAS = ['trader', 'creator', 'sme', 'student'] as const
export type Persona = (typeof PERSONAS)[number]

export interface IdentityProfile {
  name: string
  nickname: string
  language: string
  profession: string[]
  active_projects: string[]
  goals: {
    short_term: string[]
    long_term: string[]
  }
  preferences: {
    communication_style: string
    work_hours: string
  }
  timezone: string
  /** Free text server-side ("work", "trading", "learning", ...) — not a fixed
   * enum, unlike `persona` below. */
  active_mode: string
  persona: Persona
}

export interface IdentityResult {
  identity: IdentityProfile
}
