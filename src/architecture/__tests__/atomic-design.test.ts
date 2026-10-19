// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = resolve(process.cwd(), 'src')
const ui = resolve(src, 'components/ui')
const compoundControls = [
  'AppInput', 'AppSelect', 'AppTextarea', 'AppImageUpload', 'QuantityStepper', 'AppStatCard',
  // Campo de texto corto con sugerencias, ayuda y contador (Marca, Presentación).
  'AppSuggestInput',
  // Filtros de Productos: contenedor desplegable genérico, fila de filtro y chips son moléculas.
  'AppDropdownPanel', 'FilterSwitchRow', 'ActiveFilterChips',
]
const completeSections = [
  'BusinessRegistrationForm', 'CheckEmailNotice', 'ChangePasswordForm', 'DeviceCreateForm', 'DeviceIdentifyForm',
  'MemberCreateForm', 'ProductForm', 'DeviceList', 'TeamMemberList', 'ProductCard',
  // Sección completa de filtros del catálogo: el botón, su insignia y el panel.
  'ProductFiltersPanel',
  // Reponer existencia: formulario completo y su modal.
  'ProductRestockForm', 'ProductRestockModal',
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
  it.each(completeSections)('%s is a complete organism rather than a small functional molecule', (name) => {
    expect(existsSync(resolve(ui, 'organisms', `${name}.vue`))).toBe(true)
    expect(existsSync(resolve(ui, 'molecules', `${name}.vue`))).toBe(false)
  })
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

  // El panel de filtros solo presenta (props -> eventos): la orquestación (URL,
  // peticiones) vive en el composable y la vista, nunca en la UI ni en los
  // módulos de los que depende para calcular (utils/config).
  it.each([
    resolve(ui, 'organisms/ProductFiltersPanel.vue'),
    resolve(src, 'utils/product-filters.ts'),
    // La reposición solo presenta y valida: la petición vive en la vista y el store.
    resolve(ui, 'organisms/ProductRestockForm.vue'),
    resolve(ui, 'organisms/ProductRestockModal.vue'),
    resolve(src, 'utils/product-restock.ts'),
  ])('%s no depende de stores, servicios, vistas ni del barrel público', (file) => {
    const violations = imports(readFileSync(file, 'utf8')).filter((specifier) => {
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return false
      const dependency = resolveImport(file, specifier)
      return /\/(stores|services|templates|views|pages|layouts)\//.test(dependency)
        || /\/components(?:\/index(?:\.ts)?)?$/.test(dependency)
    })
    expect(violations).toEqual([])
  })
})
