import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AppImageUpload from '../AppImageUpload.vue'

function fileInput(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('input[type="file"]')
}

async function selectFile(wrapper: ReturnType<typeof mount>, file: File | undefined) {
  const input = fileInput(wrapper).element as HTMLInputElement
  Object.defineProperty(input, 'files', { value: file ? [file] : [], writable: false, configurable: true })
  await fileInput(wrapper).trigger('change')
}

describe('AppImageUpload', () => {
  beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emite el archivo cuando es un tipo/tamaño válido', async () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' })
    const wrapper = mount(AppImageUpload)

    await selectFile(wrapper, file)

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([file])
    expect(wrapper.find('.app-image-upload__error').exists()).toBe(false)
  })

  it('rechaza tipos no permitidos y emite null', async () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    const wrapper = mount(AppImageUpload)

    await selectFile(wrapper, file)

    expect(wrapper.text()).toContain('Solo se aceptan imágenes')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('rechaza archivos que exceden el tamaño máximo', async () => {
    const bigFile = new File(['x'], 'grande.png', { type: 'image/png' })
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 })
    const wrapper = mount(AppImageUpload)

    await selectFile(wrapper, bigFile)

    expect(wrapper.text()).toContain('no debe pesar más de 5 MB')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('muestra existingImageUrl como preview cuando no se ha elegido archivo nuevo', () => {
    const wrapper = mount(AppImageUpload, {
      props: { existingImageUrl: '/uploads/products/x.png' },
    })
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe('/uploads/products/x.png')
  })

  it('muestra el label cuando se provee', () => {
    const wrapper = mount(AppImageUpload, { props: { label: 'Imagen del producto' } })
    expect(wrapper.text()).toContain('Imagen del producto')
  })
})
