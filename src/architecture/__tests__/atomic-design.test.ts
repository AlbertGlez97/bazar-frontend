// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = resolve(process.cwd(), 'src')
const ui = resolve(src, 'components/ui')
const compoundControls = [
  'AppInput', 'AppSelect', 'AppTextarea', 'AppImageUpload', 'QuantityStepper', 'AppStatCard',
]

function imports(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)]
    .map((match) => match[1]!)
}

function resolveImport(file: string, specifier: string): string {
  return (specifier.startsWith('@/')
    ? resolve(src, specifier.slice(2))
    : resolve(dirname(file), specifier)).replace(/\\/g, '/')
}

describe('Atomic Design boundaries', () => {
  it.each(compoundControls)('%s is a composed molecule, not an atom', (name) => {
    expect(existsSync(resolve(ui, 'molecules', `${name}.vue`))).toBe(true)
    expect(existsSync(resolve(ui, 'atoms', `${name}.vue`))).toBe(false)
    const barrel = readFileSync(resolve(src, 'components/index.ts'), 'utf8')
    expect(barrel).toMatch(new RegExp(`as ${name}\\s*} from ['"]\\./ui/molecules/${name}\\.vue['"]`))
  })

  it('atoms do not depend on higher layers or their own public barrel', () => {
    const violations: string[] = []
    for (const name of readdirSync(resolve(ui, 'atoms')).filter((name) => name.endsWith('.vue'))) {
      const file = resolve(ui, 'atoms', name)
      for (const specifier of imports(readFileSync(file, 'utf8'))) {
        if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue
        const dependency = resolveImport(file, specifier)
        if (/\/components\/ui\/(molecules|organisms)\//.test(dependency)
          || /\/(templates|views|pages|layouts)\//.test(dependency)
          || /\/components(?:\/index(?:\.ts)?)?$/.test(dependency)) {
          violations.push(`${name} -> ${specifier}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it.each(compoundControls)('%s stays independent of application and upper visual layers', (name) => {
    const file = resolve(ui, 'molecules', `${name}.vue`)
    expect(existsSync(file)).toBe(true)
    const violations = imports(readFileSync(file, 'utf8')).filter((specifier) => {
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return false
      const dependency = resolveImport(file, specifier)
      return /\/components\/ui\/organisms\//.test(dependency)
        || /\/(stores|services|templates|views|pages|layouts)\//.test(dependency)
        || /\/components(?:\/index(?:\.ts)?)?$/.test(dependency)
    })
    expect(violations).toEqual([])
  })
})
