import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CatalogExportDialog from '../CatalogExportDialog.vue'
import { VOICE } from '@/config/voice'
import { suggestedSettings } from '@/utils/catalog-export-settings'
import type { CatalogExportSettings } from '@/types/catalog.types'

// AppModal usa <Teleport to="body">: se stubea para consultar el contenido.
const mountOptions = { global: { stubs: { teleport: true } } }

type Props = InstanceType<typeof CatalogExportDialog>['$props']

function mountDialog(props: Partial<Props> = {}, settings: Partial<CatalogExportSettings> = {}) {
  return mount(CatalogExportDialog, {
    props: {
      modelValue: true,
      settings: { ...suggestedSettings(), ...settings },
      categories: ['Hogar', 'Ropa', 'Otros'],
      candidates: [
        { id: 'a', name: 'Taza azul', detail: 'Sol · 350 ml' },
        { id: 'b', name: 'Playera', detail: '' },
        { id: 'c', name: 'Árbol de la vida', detail: '' },
      ],
      summary: { products: 12, merged: 3, photos: 9, categories: 4 },
      loaded: true,
      phase: 'idle',
      progress: { done: 0, total: 0 },
      offline: false,
      error: '',
      ...props,
    } as Props,
    ...mountOptions,
  })
}

const button = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('button').find((b) => b.text().includes(label))
const switchFor = (wrapper: ReturnType<typeof mount>, label: string) => {
  const row = wrapper.findAll('.filter-switch-row').find((r) => r.find('label').text() === label)
  if (!row) throw new Error(`No hay ajuste "${label}"`)
  return row.get('input[type="checkbox"]')
}
const lastPatch = (wrapper: ReturnType<typeof mount>) => wrapper.emitted('update:settings')!.at(-1)![0]

describe('CatalogExportDialog — estructura', () => {
  it('agrupa los ajustes y cada uno trae una línea de por qué', () => {
    const text = mountDialog().text()
    for (const title of Object.values(VOICE.catalogExport.groups)) {
      // "Existencia" y "Calidad de foto" salen solo si aplican; aquí aplican (existencia y foto prendidas).
      expect(text).toContain(title)
    }
    for (const hint of [
      VOICE.catalogExport.group.hint, VOICE.catalogExport.fields.photoHint, VOICE.catalogExport.fields.priceHint,
      VOICE.catalogExport.stockMode.hint, VOICE.catalogExport.design.columnsHint, VOICE.catalogExport.cover.showDateHint,
      VOICE.catalogExport.photoQuality.hint, VOICE.catalogExport.filter.hint,
    ]) expect(text).toContain(hint)
  })

  it('el estado inicial refleja los valores sugeridos', () => {
    const wrapper = mountDialog()
    expect((switchFor(wrapper, VOICE.catalogExport.group.label).element as HTMLInputElement).checked).toBe(true)
    expect((switchFor(wrapper, VOICE.catalogExport.cover.toc).element as HTMLInputElement).checked).toBe(false)
    expect((switchFor(wrapper, VOICE.catalogExport.cover.showDate).element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('.segmented-control__btn[data-value="2"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.segmented-control__btn[data-value="exact"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.segmented-control__btn[data-value="normal"]').attributes('aria-pressed')).toBe('true')
  })

  it('el nombre del negocio llega prellenado y editable', async () => {
    const wrapper = mountDialog({}, { businessName: 'Bazar Lupe' })
    const label = wrapper.findAll('label').find((l) => l.text().includes(VOICE.catalogExport.businessName))!
    const input = wrapper.get(`#${label.attributes('for')}`)
    expect((input.element as HTMLInputElement).value).toBe('Bazar Lupe')
    // Un campo con autocompletado debe declarar su tipo (Sonar Web:S6840).
    expect(input.attributes('type')).toBe('text')
    expect(input.attributes('autocomplete')).toBe('off')
    await input.setValue('Bazar Nuevo')
    expect(lastPatch(wrapper)).toEqual({ businessName: 'Bazar Nuevo' })
  })

  it('muestra el resumen antes de generar: productos, variantes agrupadas, fotos y categorías', () => {
    expect(mountDialog().text()).toContain(VOICE.catalogExport.summary(12, 3, 9, 4))
  })

  it('con las fotos apagadas el resumen no promete fotos y se oculta la calidad', () => {
    const wrapper = mountDialog({}, { fields: { ...suggestedSettings().fields, photo: false } })
    expect(wrapper.text()).toContain(VOICE.catalogExport.summary(12, 3, 0, 4))
    expect(wrapper.text()).not.toContain(VOICE.catalogExport.groups.photo)
  })

  it('sin productos dice que no entra ninguno y no deja generar', () => {
    const wrapper = mountDialog({ summary: { products: 0, merged: 0, photos: 0, categories: 0 } })
    expect(wrapper.text()).toContain(VOICE.catalogExport.summaryEmpty)
    expect(button(wrapper, VOICE.catalogExport.generate)!.attributes('disabled')).toBeDefined()
  })
})

describe('CatalogExportDialog — cambios', () => {
  it('cada interruptor emite su cambio parcial', async () => {
    const wrapper = mountDialog()
    await switchFor(wrapper, VOICE.catalogExport.group.label).setValue(false)
    expect(lastPatch(wrapper)).toEqual({ groupVariants: false })
    await switchFor(wrapper, VOICE.catalogExport.fields.brand).setValue(false)
    expect(lastPatch(wrapper)).toEqual({ fields: { brand: false } })
    await switchFor(wrapper, VOICE.catalogExport.cover.toc).setValue(true)
    expect(lastPatch(wrapper)).toEqual({ tableOfContents: true })
    await switchFor(wrapper, VOICE.catalogExport.design.pageBreak).setValue(false)
    expect(lastPatch(wrapper)).toEqual({ pageBreakPerCategory: false })
    await switchFor(wrapper, VOICE.catalogExport.cover.showDate).setValue(false)
    expect(lastPatch(wrapper)).toEqual({ showDate: false })
  })

  it('las columnas, la calidad y la existencia emiten su valor', async () => {
    const wrapper = mountDialog()
    await wrapper.get('.segmented-control__btn[data-value="3"]').trigger('click')
    expect(lastPatch(wrapper)).toEqual({ columns: 3 })
    await wrapper.get('.segmented-control__btn[data-value="high"]').trigger('click')
    expect(lastPatch(wrapper)).toEqual({ photoQuality: 'high' })
    await wrapper.get('.segmented-control__btn[data-value="availability"]').trigger('click')
    expect(lastPatch(wrapper)).toEqual({ stockMode: 'availability' })
  })

  it('el umbral de "Últimas piezas" solo aparece en modo disponibilidad y emite enteros', async () => {
    expect(mountDialog().text()).not.toContain(VOICE.catalogExport.stockMode.thresholdLabel)
    const wrapper = mountDialog({}, { stockMode: 'availability' })
    const label = wrapper.findAll('label').find((l) => l.text().includes(VOICE.catalogExport.stockMode.thresholdLabel))!
    const input = wrapper.get(`#${label.attributes('for')}`)
    await input.setValue('5')
    expect(lastPatch(wrapper)).toEqual({ lowStockThreshold: 5 })
    const before = wrapper.emitted('update:settings')!.length
    await input.setValue('')
    await input.setValue('2.5')
    expect(wrapper.emitted('update:settings')!.length).toBe(before)
  })

  it('con la existencia apagada no se ofrece cómo mostrarla', () => {
    const wrapper = mountDialog({}, { fields: { ...suggestedSettings().fields, stock: false } })
    expect(wrapper.text()).not.toContain(VOICE.catalogExport.stockMode.label)
  })

  it('el índice avisa que Word va a preguntar si se actualiza el documento', () => {
    expect(mountDialog().text()).not.toContain(VOICE.catalogExport.cover.tocWarning)
    expect(mountDialog({}, { tableOfContents: true }).text()).toContain('Word te preguntará si quieres actualizar el documento: di que sí.')
  })
})

describe('CatalogExportDialog — qué entra', () => {
  it('cambia de modo conservando lo ya elegido', async () => {
    const wrapper = mountDialog()
    await wrapper.get('.segmented-control__btn[data-value="categories"]').trigger('click')
    expect(lastPatch(wrapper)).toEqual({ filter: { mode: 'categories', categories: [] } })
    await wrapper.get('.segmented-control__btn[data-value="in-stock"]').trigger('click')
    expect(lastPatch(wrapper)).toEqual({ filter: { mode: 'in-stock' } })
  })

  it('por categorías: casillas de cada categoría, selección múltiple', async () => {
    const wrapper = mountDialog({}, { filter: { mode: 'categories', categories: ['Hogar'] } })
    const boxes = wrapper.findAll('.catalog-export__list input[type="checkbox"]')
    expect(boxes).toHaveLength(3)
    expect((boxes[0]!.element as HTMLInputElement).checked).toBe(true)
    await boxes[1]!.setValue(true)
    expect(lastPatch(wrapper)).toEqual({ filter: { mode: 'categories', categories: ['Hogar', 'Ropa'] } })
    await boxes[0]!.setValue(false)
    expect(lastPatch(wrapper)).toEqual({ filter: { mode: 'categories', categories: [] } })
  })

  it('selección manual con buscador (sin acentos ni mayúsculas) y contador', async () => {
    const wrapper = mountDialog({}, { filter: { mode: 'manual', ids: ['b'] } })
    expect(wrapper.text()).toContain(VOICE.catalogExport.filter.manualCount(1))
    expect(wrapper.findAll('.catalog-export__scroll input')).toHaveLength(3)

    const label = wrapper.findAll('label').find((l) => l.text().includes(VOICE.catalogExport.filter.searchLabel))!
    await wrapper.get(`#${label.attributes('for')}`).setValue('ARBOL')
    const visible = wrapper.findAll('.catalog-export__scroll input')
    expect(visible).toHaveLength(1)
    await visible[0]!.setValue(true)
    expect(lastPatch(wrapper)).toEqual({ filter: { mode: 'manual', ids: ['b', 'c'] } })

    await wrapper.get(`#${label.attributes('for')}`).setValue('zzz')
    expect(wrapper.text()).toContain(VOICE.catalogExport.filter.manualEmpty)
  })

  it('con muchísimos productos solo dibuja una parte y avisa', () => {
    const candidates = Array.from({ length: 250 }, (_, i) => ({ id: `p${i}`, name: `Producto ${i}`, detail: '' }))
    const wrapper = mountDialog({ candidates }, { filter: { mode: 'manual', ids: [] } })
    expect(wrapper.findAll('.catalog-export__scroll input')).toHaveLength(100)
    expect(wrapper.text()).toContain(VOICE.catalogExport.filter.manualMore(100, 250))
  })
})

describe('CatalogExportDialog — estados', () => {
  it('"Restaurar sugeridos" y "Generar catálogo" emiten sus eventos', async () => {
    const wrapper = mountDialog()
    await button(wrapper, VOICE.catalogExport.restore)!.trigger('click')
    await button(wrapper, VOICE.catalogExport.generate)!.trigger('click')
    expect(wrapper.emitted('restore')).toHaveLength(1)
    expect(wrapper.emitted('generate')).toHaveLength(1)
  })

  it('sin internet avisa y no deja generar', () => {
    const wrapper = mountDialog({ offline: true })
    expect(wrapper.text()).toContain(VOICE.catalogExport.offline)
    expect(button(wrapper, VOICE.catalogExport.generate)!.attributes('disabled')).toBeDefined()
  })

  it('mientras baja los productos muestra el aviso y no muestra los ajustes', () => {
    const wrapper = mountDialog({ loaded: false, phase: 'loading' })
    expect(wrapper.text()).toContain(VOICE.catalogExport.loading)
    expect(wrapper.text()).not.toContain(VOICE.catalogExport.groups.fields)
    expect(button(wrapper, VOICE.catalogExport.generate)!.attributes('disabled')).toBeDefined()
  })

  it('si no pudo cargar, muestra el error y "Intentar de nuevo"', async () => {
    const wrapper = mountDialog({ loaded: false, error: 'No pudimos conectarnos.' })
    expect(wrapper.text()).toContain('No pudimos conectarnos.')
    await button(wrapper, VOICE.catalogExport.retry)!.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('preparando fotos: barra de avance, cancelar disponible y todo lo demás bloqueado', async () => {
    const wrapper = mountDialog({ phase: 'photos', progress: { done: 3, total: 12 } })
    expect(wrapper.text()).toContain(VOICE.catalogExport.photosProgress(3, 12))
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('25')
    await button(wrapper, VOICE.catalogExport.cancel)!.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(button(wrapper, VOICE.catalogExport.restore)!.attributes('disabled')).toBeDefined()
  })

  it('armando el documento: barra completa y sin botón de cancelar', () => {
    const wrapper = mountDialog({ phase: 'document', progress: { done: 12, total: 12 } })
    expect(wrapper.text()).toContain(VOICE.catalogExport.documentProgress)
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
    expect(button(wrapper, VOICE.catalogExport.cancel)).toBeUndefined()
  })
})
