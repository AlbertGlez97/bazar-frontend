// Marca, presentación y descripción breve en el formulario de producto.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductForm from '../ProductForm.vue'
import { makeProduct } from '@/test/factories'

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
})

const mountForm = (props: Record<string, unknown> = {}) => mount(ProductForm, { props, attachTo: document.body })

const byLabel = (wrapper: ReturnType<typeof mountForm>, text: string) => {
  const label = wrapper.findAll('label').find((candidate) => candidate.text().startsWith(text))
  if (!label) throw new Error(`No hay etiqueta "${text}"`)
  return wrapper.get(`[id="${label.attributes('for')}"]`)
}

async function fillRequired(wrapper: ReturnType<typeof mountForm>) {
  await byLabel(wrapper, 'Nombre').setValue('Playera')
  const decimals = wrapper.findAll('input').filter((input) => input.attributes('inputmode') === 'decimal')
  await decimals[0].setValue('150')
  await decimals[1].setValue('90')
}

const lastSubmit = (wrapper: ReturnType<typeof mountForm>) => wrapper.emitted('submit')!.at(-1)![0] as Record<string, unknown>

describe('ProductForm — marca, presentación y descripción', () => {
  it('los tres campos existen, con etiqueta, y son opcionales', () => {
    const wrapper = mountForm()

    expect(byLabel(wrapper, 'Marca').element.tagName).toBe('INPUT')
    expect(byLabel(wrapper, 'Presentación').element.tagName).toBe('INPUT')
    expect(byLabel(wrapper, 'Descripción breve').element.tagName).toBe('TEXTAREA')
    expect(wrapper.text()).toContain('Marca (opcional)')
    expect(wrapper.text()).toContain('Presentación (opcional)')
    expect(wrapper.text()).toContain('Descripción breve (opcional)')
  })

  it('cada uno limita la escritura a su máximo: 40, 40 y 200', () => {
    const wrapper = mountForm()

    expect(byLabel(wrapper, 'Marca').attributes('maxlength')).toBe('40')
    expect(byLabel(wrapper, 'Presentación').attributes('maxlength')).toBe('40')
    expect(byLabel(wrapper, 'Descripción breve').attributes('maxlength')).toBe('200')
  })

  it('ayudas cortas y contadores visibles', () => {
    const wrapper = mountForm()

    expect(wrapper.text()).toContain('Ej. XL, 24 oz')
    const counters = wrapper.findAll('.app-char-counter').map((counter) => counter.text())
    expect(counters).toEqual(expect.arrayContaining([expect.stringContaining('0/40'), expect.stringContaining('0/200')]))
  })

  it('el contador sigue lo que se escribe', async () => {
    const wrapper = mountForm()

    await byLabel(wrapper, 'Marca').setValue('Nike')

    expect(wrapper.text()).toContain('4/40')
  })

  it('las sugerencias de marca y de presentación llegan como listas ligadas a su campo', () => {
    const wrapper = mountForm({ brandSuggestions: ['Adidas', 'Nike'], presentationSuggestions: ['24 oz', 'XL'] })

    const brandList = byLabel(wrapper, 'Marca').attributes('list')!
    const presentationList = byLabel(wrapper, 'Presentación').attributes('list')!
    expect(wrapper.findAll(`[id="${brandList}"] option`).map((option) => option.attributes('value'))).toEqual(['Adidas', 'Nike'])
    expect(wrapper.findAll(`[id="${presentationList}"] option`).map((option) => option.attributes('value'))).toEqual(['24 oz', 'XL'])
  })

  it('sin sugerencias (un colaborador, o sin red) los campos son de texto libre', () => {
    const wrapper = mountForm()

    expect(byLabel(wrapper, 'Marca').attributes('list')).toBeUndefined()
  })

  it('el color va dentro de la presentación: la ayuda lo dice', () => {
    expect(mountForm().text()).toMatch(/Azul · 28/)
  })

  describe('al crear', () => {
    it('envía los tres, limpios (espacios juntos y recortados)', async () => {
      const wrapper = mountForm()
      await fillRequired(wrapper)
      await byLabel(wrapper, 'Marca').setValue('  Casa   Vieja ')
      await byLabel(wrapper, 'Presentación').setValue(' Azul  ·   28 ')
      await byLabel(wrapper, 'Descripción breve').setValue('Algodón\nsuave')

      await wrapper.find('form').trigger('submit')

      expect(lastSubmit(wrapper)).toMatchObject({
        brand: 'Casa Vieja',
        presentation: 'Azul · 28',
        description: 'Algodón suave',
      })
    })

    it('vacíos o en blanco no se envían (el servidor los guarda como nulos)', async () => {
      const wrapper = mountForm()
      await fillRequired(wrapper)
      await byLabel(wrapper, 'Marca').setValue('   ')

      await wrapper.find('form').trigger('submit')

      const payload = lastSubmit(wrapper)
      expect(payload.brand).toBeUndefined()
      expect(payload.presentation).toBeUndefined()
      expect(payload.description).toBeUndefined()
    })
  })

  describe('al editar', () => {
    const product = makeProduct({
      name: 'Playera', purchaseCostMinor: 9000, unitPriceMinor: 15000,
      brand: 'Nike', presentation: 'XL', description: 'Algodón',
    })

    it('precarga los tres', () => {
      const wrapper = mountForm({ product })

      expect((byLabel(wrapper, 'Marca').element as HTMLInputElement).value).toBe('Nike')
      expect((byLabel(wrapper, 'Presentación').element as HTMLInputElement).value).toBe('XL')
      expect((byLabel(wrapper, 'Descripción breve').element as HTMLTextAreaElement).value).toBe('Algodón')
    })

    it('sin cambios no manda nada de esto', async () => {
      const wrapper = mountForm({ product })

      await wrapper.find('form').trigger('submit')

      const payload = lastSubmit(wrapper)
      expect(payload).not.toHaveProperty('brand')
      expect(payload).not.toHaveProperty('presentation')
      expect(payload).not.toHaveProperty('description')
    })

    it('solo manda el campo que cambió', async () => {
      const wrapper = mountForm({ product })
      await byLabel(wrapper, 'Presentación').setValue('L')

      await wrapper.find('form').trigger('submit')

      const payload = lastSubmit(wrapper)
      expect(payload.presentation).toBe('L')
      expect(payload).not.toHaveProperty('brand')
      expect(payload).not.toHaveProperty('description')
    })

    it('vaciar un campo manda null (se borra)', async () => {
      const wrapper = mountForm({ product })
      await byLabel(wrapper, 'Marca').setValue('')
      await byLabel(wrapper, 'Descripción breve').setValue('   ')

      await wrapper.find('form').trigger('submit')

      expect(lastSubmit(wrapper)).toMatchObject({ brand: null, description: null })
    })

    it('un cambio que solo mueve espacios no cuenta como cambio', async () => {
      const wrapper = mountForm({ product })
      await byLabel(wrapper, 'Marca').setValue('  Nike  ')

      await wrapper.find('form').trigger('submit')

      expect(lastSubmit(wrapper)).not.toHaveProperty('brand')
    })

    it('un producto de antes (sin los campos) abre con los campos vacíos y no manda null por nada', async () => {
      const legacy = makeProduct({ name: 'Viejo', purchaseCostMinor: 100 })
      delete (legacy as Partial<typeof legacy>).brand
      delete (legacy as Partial<typeof legacy>).presentation
      delete (legacy as Partial<typeof legacy>).description
      const wrapper = mountForm({ product: legacy })

      expect((byLabel(wrapper, 'Marca').element as HTMLInputElement).value).toBe('')
      await wrapper.find('form').trigger('submit')

      expect(lastSubmit(wrapper)).not.toHaveProperty('brand')
    })
  })
})
