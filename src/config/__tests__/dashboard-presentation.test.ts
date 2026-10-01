import { describe, expect, it } from 'vitest'
import home from '../../views/AppHomeView.vue?raw'
import card from '../../components/ui/molecules/AppStatCard.vue?raw'

function rule(source: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const body = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(source)?.[1]
  expect(body, selector).toBeDefined()
  return body!
}

describe('dashboard presentation CSS contracts', () => {
  it('uses the available width and fits columns without overflowing narrow containers', () => {
    expect(rule(home, '.app-home')).toMatch(/width:\s*100%/)
    expect(rule(home, '.app-home')).not.toMatch(/max-width:\s*60rem/)
    expect(rule(home, '.app-home__cards')).toMatch(/repeat\(auto-fit,\s*minmax\(min\(100%,\s*16rem\),\s*1fr\)\)/)
  })

  it('keeps large values shrinkable and gives cards branded surface depth', () => {
    expect(rule(card, '.app-stat-card')).toMatch(/min-width:\s*0/)
    expect(rule(card, '.app-stat-card')).toMatch(/box-shadow:\s*var\(--shadow-sm\)/)
    expect(rule(card, '.app-stat-card__value')).toMatch(/overflow-wrap:\s*anywhere/)
  })
})
