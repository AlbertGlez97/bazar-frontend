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

describe.each(MOTION_FILES)('%s', (file) => {
  const source = read(file)
  const style = source.slice(source.indexOf('<style'))

  it('uses motion tokens, never literal durations', () => {
    const transitions = style.split('\n').filter((line) => /transition|animation/.test(line) && /\d(ms|s)\b/.test(line))
    // Allowed literal: the `0s` delay of the visibility switch in the accordion.
    expect(transitions.filter((line) => !/\b0s\b/.test(line))).toEqual([])
  })

  it('animates only transform, opacity, grid rows and colors, never height', () => {
    expect(style).not.toMatch(/transition[^;]*\b(max-)?height\b/)
    expect(style).not.toMatch(/animation:\s*[^;]*height/)
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
