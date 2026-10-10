import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// jsdom does not run CSS transitions, so motion is checked as a contract on the
// sources: tokens instead of literal durations, a reduced-motion override, and
// no animation of layout properties. Real playback is validated in a browser.
const read = (path: string) => readFileSync(path, 'utf8')
const css = read('src/assets/main.css')

const MOTION_FILES = [
  'src/components/help/HelpCenter.vue',
  'src/components/help/HelpSidebar.vue',
  'src/components/help/HelpLinkList.vue',
  'src/components/help/HelpSearchResults.vue',
  'src/components/help/HelpDrawer.vue',
  'src/components/ui/organisms/AppDrawer.vue',
  'src/components/ui/molecules/AppAccordion.vue',
]

function reducedMotionBlock(source: string): string {
  const start = source.indexOf('@media (prefers-reduced-motion: reduce)')
  if (start < 0) return ''
  let depth = 0
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') { depth -= 1; if (depth === 0) return source.slice(start, index + 1) }
  }
  return ''
}

describe('help motion tokens', () => {
  it('defines the motion tokens with the planned durations', () => {
    expect(css).toMatch(/--motion-fast:\s*150ms/)
    expect(css).toMatch(/--motion-base:\s*180ms/)
    expect(css).toMatch(/--motion-slow:\s*220ms/)
    expect(css).toMatch(/--motion-shift:\s*8px/)
  })

  it('zeroes the tokens and the help components under prefers-reduced-motion: reduce', () => {
    const block = reducedMotionBlock(css)
    expect(block).not.toBe('')
    for (const token of ['--motion-fast', '--motion-base', '--motion-slow']) {
      expect(block).toMatch(new RegExp(`${token}:\\s*0\\.01ms`))
    }
    expect(block).toMatch(/--motion-shift:\s*0px/)
    for (const selector of ['.help-center', '.app-drawer-root', '.app-accordion']) expect(block).toContain(selector)
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
  })
})

/** The `<style>` block of an SFC, without comments. Fails loudly when there is none. */
function styleOf(file: string): string {
  const source = read(file)
  const match = /<style[^>]*>([sS]*?)</style>/.exec(source)
  if (!match) throw new Error(`${file} has no <style> block`)
  return match[1]!.replace(//*[sS]*?*//g, '')
}

/** Split on commas that are not inside parentheses (`a 1s, b var(--x, 2s)`). */
function splitTopLevel(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of value) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) { parts.push(current); current = '' } else current += char
  }
  parts.push(current)
  return parts.map((part) => part.trim()).filter(Boolean)
}

const LITERAL_TIME = /^-?(d*.)?d+m?s$/

/**
 * Literal durations/delays in transition and animation declarations, parsed per declaration
 * (so multi-line values are covered). Allowed, and only these:
 *  - a zero literal (`0s`/`0ms`) on a `visibility` transition item: visibility is a discrete
 *    property, its `0s` duration plus a tokenized delay is what keeps closed panels hidden after they collapse;
 *  - `transition-delay: 0s` (resetting the delay in the open state).
 * Everything else must come from `var(--motion-*)`.
 */
function literalDurations(style: string): string[] {
  const found: string[] = []
  const declaration = /(?:^|[;{s])((?:transition|animation)(?:-[a-z]+)*)s*:s*([^;}]+)/g
  for (const match of style.matchAll(declaration)) {
    const property = match[1]!
    const value = match[2]!
    if (property === 'transition-property' || property === 'animation-name') continue
    for (const item of splitTopLevel(value)) {
      // Drop var(...) calls: they are the tokenized, allowed form.
      const tokens = item.replace(/var([^)]*)/g, ' ').split(/s+/).filter(Boolean)
      const times = tokens.filter((token) => LITERAL_TIME.test(token))
      if (times.length === 0) continue
      const zero = times.every((token) => /^0m?s$/.test(token))
      const visibilityItem = property === 'transition' && tokens[0] === 'visibility'
      const delayReset = property === 'transition-delay'
      if (!(zero && (visibilityItem || delayReset))) found.push(`${property}: ${item}`)
    }
  }
  return found
}

describe('literalDurations (the guard itself)', () => {
  it('flags literal durations on one line, across lines and inside lists', () => {
    expect(literalDurations('a { transition: opacity 200ms ease; }')).toHaveLength(1)
    expect(literalDurations('a {
  transition:
    opacity var(--motion-base) ease,
    transform .3s ease;
}')).toHaveLength(1)
    expect(literalDurations('a { animation: spin 1s linear infinite; }')).toHaveLength(1)
    expect(literalDurations('a { transition: opacity 0s; }')).toHaveLength(1)
    expect(literalDurations('a { transition: visibility 5s linear var(--motion-base); }')).toHaveLength(1)
    expect(literalDurations('a { transition-duration: 150ms; }')).toHaveLength(1)
  })

  it('accepts tokens, the visibility zero-duration switch and a delay reset', () => {
    expect(literalDurations('a { transition: opacity var(--motion-base) var(--motion-ease); }')).toEqual([])
    expect(literalDurations('a {
 transition:
  grid-template-rows var(--motion-base) var(--motion-ease),
  visibility 0s linear var(--motion-base);
}')).toEqual([])
    expect(literalDurations('a { transition-delay: 0s; }')).toEqual([])
    expect(literalDurations('a { transition: none; }')).toEqual([])
  })
})

describe.each(MOTION_FILES)('%s', (file) => {
  const style = styleOf(file)

  it('has a style block with real rules', () => {
    expect(style.trim().length).toBeGreaterThan(0)
  })

  it('uses motion tokens, never literal durations', () => {
    expect(literalDurations(style)).toEqual([])
  })

  it('animates only transform, opacity, grid rows and colors, never height', () => {
    expect(style).not.toMatch(/transition[^;]*(max-)?height/)
    expect(style).not.toMatch(/animation:s*[^;]*height/)
  })
})

describe('component reduced-motion overrides', () => {
  it.each([
    'src/components/help/HelpCenter.vue',
    'src/components/ui/organisms/AppDrawer.vue',
    'src/components/ui/molecules/AppAccordion.vue',
  ])('%s switches its transitions off', (file) => {
    const block = reducedMotionBlock(read(file))
    expect(block).not.toBe('')
    expect(block).toMatch(/transition:\s*none/)
  })

  it('the drawer and the topic swap drop their transforms when motion is reduced', () => {
    expect(reducedMotionBlock(read('src/components/ui/organisms/AppDrawer.vue'))).toMatch(/transform:\s*none/)
    expect(reducedMotionBlock(read('src/components/help/HelpCenter.vue'))).toMatch(/transform:\s*none/)
  })

  it('animates the accordion through grid rows, not height', () => {
    const source = read('src/components/ui/molecules/AppAccordion.vue')
    expect(source).toMatch(/grid-template-rows:\s*0fr/)
    expect(source).toMatch(/transition:[\s\S]*grid-template-rows/)
  })
})

describe('JavaScript motion choices', () => {
  it('the Center asks the reduced-motion composable instead of hardcoding smooth scrolling', () => {
    const source = read('src/components/help/HelpCenter.vue')
    expect(source).toContain('usePrefersReducedMotion')
    expect(source).not.toMatch(/behavior:\s*'smooth'/)
    expect(source).toMatch(/behavior:\s*scrollBehavior\.value/)
  })

  it('no help component scrolls the whole page into view', () => {
    for (const file of MOTION_FILES) expect(read(file)).not.toMatch(/scrollIntoView\([^)]*block:\s*'(start|center|end)'/)
  })
})
