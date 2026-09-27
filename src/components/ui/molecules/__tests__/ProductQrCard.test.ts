import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProductQrCard from '../ProductQrCard.vue'
import { saveBlob } from '@/utils/report-files'
import * as productQr from '@/utils/product-qr'

vi.mock('@/utils/report-files', () => ({ saveBlob: vi.fn() }))

const ID = '01a0ddd7-7f00-744a-8b23-72c005912b97'

beforeEach(() => {
  vi.mocked(saveBlob).mockReset()
  vi.restoreAllMocks()
})

/** El primer `import('qrcode')` tarda un tick real: se espera a que salga la imagen o el aviso de error. */
async function settle(wrapper: ReturnType<typeof mount>) {
  await vi.waitFor(() => {
    expect(wrapper.find('img').exists() || wrapper.find('[role="alert"]').exists()).toBe(true)
  })
}

async function mountCard(props: { productId: string; productName: string }, options: { wait?: boolean } = {}) {
  const wrapper = mount(ProductQrCard, { props })
  await flushPromises()
  if (options.wait !== false) await settle(wrapper)
  return wrapper
}

describe('ProductQrCard', () => {
  it('shows the generated QR as an accessible image', async () => {
    const wrapper = await mountCard({ productId: ID, productName: 'Bonsái Ficus' })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toMatch(/^data:image\/png;base64,/)
    expect(img.attributes('alt')).toBe('Código QR de Bonsái Ficus')
  })

  it('shows the image with the code of this id (not another one)', async () => {
    const expected = await productQr.productQrDataUrl(ID)
    const wrapper = await mountCard({ productId: ID, productName: 'X' })
    expect(wrapper.find('img').attributes('src')).toBe(expected)
  })

  it('offers the PNG download with the right file name and a PNG blob', async () => {
    const wrapper = await mountCard({ productId: ID, productName: 'Bonsái Ficus' })
    const button = wrapper.findAll('button').find((b) => b.text().includes('Descargar QR'))
    expect(button).toBeTruthy()
    await button!.trigger('click')
    await vi.waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1))
    const [blob, filename] = vi.mocked(saveBlob).mock.calls[0]!
    expect((blob as Blob).type).toBe('image/png')
    expect(filename).toBe('qr-bonsai-ficus-01a0ddd7.png')
  })

  it('renders nothing for an id that is not a UUID (the scanner could never match it)', async () => {
    const wrapper = await mountCard({ productId: 'p-1', productName: 'X' }, { wait: false })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('regenerates the code when the product changes', async () => {
    const wrapper = await mountCard({ productId: ID, productName: 'A' })
    const first = wrapper.find('img').attributes('src')
    await wrapper.setProps({ productId: '0190a5f0-7c3e-7000-8000-00000000000a', productName: 'B' })
    await vi.waitFor(() => {
      expect(wrapper.find('img').exists()).toBe(true)
      expect(wrapper.find('img').attributes('src')).not.toBe(first)
    })
    expect(wrapper.find('img').attributes('alt')).toBe('Código QR de B')
  })

  it('shows a clear message (and no broken image) when the code cannot be generated', async () => {
    vi.spyOn(productQr, 'productQrDataUrl').mockRejectedValue(new Error('boom'))
    const wrapper = await mountCard({ productId: ID, productName: 'X' })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('No pudimos generar el código QR')
  })

  it('shows a clear message when the download fails and keeps the button usable', async () => {
    const wrapper = await mountCard({ productId: ID, productName: 'X' })
    vi.mocked(saveBlob).mockImplementation(() => { throw new Error('disk full') })
    const button = wrapper.findAll('button').find((b) => b.text().includes('Descargar QR'))!
    await button.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No pudimos descargar'))
    expect(button.attributes('disabled')).toBeUndefined()
  })
})
