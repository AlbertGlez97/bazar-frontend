import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LabelPrintDialog from '../LabelPrintDialog.vue'
import { VOICE } from '@/config/voice'
import { CALIBRATION_LIMITS, DEFAULT_CALIBRATION, type LabelCalibration, type LabelDesign } from '@/utils/label-sheet-plan'

// AppModal usa <Teleport to="body">: se stubea para consultar el contenido.
const mountOptions = { global: { stubs: { teleport: true } } }

type DialogProps = { labelCount: number; calibration: LabelCalibration; design: LabelDesign; busy: 'preview' | 'download' | null; error: string }

function mountDialog(props: Partial<DialogProps> = {}) {
  return mount(LabelPrintDialog, {
    props: { modelValue: true, labelCount: 10, calibration: { ...DEFAULT_CALIBRATION }, design: 'qr-only', busy: null, error: '', ...props },
    ...mountOptions,
  })
}
/** El campo (wrapper del input) que va con esa etiqueta: se enlaza por `for` -> `id`. */
const field = (wrapper: ReturnType<typeof mount>, label: string) => {
  const labelEl = wrapper.findAll('label').find((l) => l.text().includes(label))!
  return wrapper.find(`#${labelEl.attributes('for')}`)
}
const inputOf = (wrapper: ReturnType<typeof mount>, label: string) => field(wrapper, label).element as HTMLInputElement
const button = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('button').find((b) => b.text().includes(label))

describe('LabelPrintDialog — resumen de hojas (30 por hoja)', () => {
  it.each([
    [1, '1 etiqueta', '1 hoja'],
    [10, '10 etiquetas', '1 hoja'],
    [30, '30 etiquetas', '1 hoja'],
    [31, '31 etiquetas', '2 hojas'],
    [60, '60 etiquetas', '2 hojas'],
    [61, '61 etiquetas', '3 hojas'],
  ])('%i etiquetas -> "%s" y "%s"', (count, labels, sheets) => {
    const text = mountDialog({ labelCount: count }).text()
    expect(text).toContain(labels)
    expect(text).toContain('30 etiquetas por hoja')
    expect(text).toContain(sheets)
  })
})

describe('LabelPrintDialog — diseño de la etiqueta', () => {
  const designButton = (wrapper: ReturnType<typeof mount>, value: LabelDesign) => wrapper.find(`.segmented-control__btn[data-value="${value}"]`)

  it('ofrece "Solo QR" y "QR + detalle" y marca el elegido', () => {
    const wrapper = mountDialog({ design: 'qr-detail' })
    expect(wrapper.findAll('.segmented-control')).toHaveLength(1)
    expect(designButton(wrapper, 'qr-only').text()).toBe(VOICE.labels.designOnlyQr)
    expect(designButton(wrapper, 'qr-detail').text()).toBe(VOICE.labels.designQrDetail)
    expect(designButton(wrapper, 'qr-detail').attributes('aria-pressed')).toBe('true')
    expect(designButton(wrapper, 'qr-only').attributes('aria-pressed')).toBe('false')
  })

  it('emite el diseño nuevo al tocarlo y nada si ya estaba elegido', async () => {
    const wrapper = mountDialog({ design: 'qr-only' })
    await designButton(wrapper, 'qr-only').trigger('click')
    expect(wrapper.emitted('update:design')).toBeUndefined()
    await designButton(wrapper, 'qr-detail').trigger('click')
    expect(wrapper.emitted('update:design')).toEqual([['qr-detail']])
  })
})

describe('LabelPrintDialog — calibración', () => {
  const CALIBRATED: LabelCalibration = { marginTopMm: 10.2, marginLeftMm: 6.1, labelWidthMm: 66.2, labelHeightMm: 25.1, gapXMm: 3.6, pitchYMm: 25.6 }
  const LABELS = [
    ['marginTopMm', VOICE.labels.marginTop],
    ['marginLeftMm', VOICE.labels.marginLeft],
    ['labelWidthMm', VOICE.labels.labelWidth],
    ['labelHeightMm', VOICE.labels.labelHeight],
    ['gapXMm', VOICE.labels.gapX],
    ['pitchYMm', VOICE.labels.pitchY],
  ] as const

  it('muestra los seis campos con sus valores', () => {
    const wrapper = mountDialog({ calibration: CALIBRATED })
    for (const [key, label] of LABELS) expect(inputOf(wrapper, label).value).toBe(String(CALIBRATED[key]))
  })

  it('los campos son numéricos, con su paso y su rango', () => {
    const wrapper = mountDialog()
    for (const [key, label] of LABELS) {
      const input = inputOf(wrapper, label)
      expect(input.type).toBe('number')
      expect(input.step).toBe(String(CALIBRATION_LIMITS[key].step))
      expect(input.min).toBe(String(CALIBRATION_LIMITS[key].min))
      expect(input.max).toBe(String(CALIBRATION_LIMITS[key].max))
    }
  })

  it('un valor válido (decimales incluidos) se emite como cambio parcial', async () => {
    const wrapper = mountDialog()
    await field(wrapper, VOICE.labels.marginTop).setValue('11.2')
    await field(wrapper, VOICE.labels.labelWidth).setValue('67')
    await field(wrapper, VOICE.labels.gapX).setValue('0')
    expect(wrapper.emitted('update:calibration')).toEqual([[{ marginTopMm: 11.2 }], [{ labelWidthMm: 67 }], [{ gapXMm: 0 }]])
  })

  it.each(['', 'abc', '99', '-99'])('un valor inválido (%j) muestra el rango y NO se emite', async (bad) => {
    const wrapper = mountDialog()
    await field(wrapper, VOICE.labels.marginTop).setValue(bad)
    expect(wrapper.emitted('update:calibration')).toBeUndefined()
    const { min, max } = CALIBRATION_LIMITS.marginTopMm
    expect(wrapper.text()).toContain(VOICE.labels.rangeError(min, max))
  })

  it('cada campo usa su propio rango en el error', async () => {
    const wrapper = mountDialog()
    await field(wrapper, VOICE.labels.pitchY).setValue('5')
    const { min, max } = CALIBRATION_LIMITS.pitchYMm
    expect(wrapper.text()).toContain(VOICE.labels.rangeError(min, max))
  })

  it('el error desaparece al escribir un valor válido', async () => {
    const wrapper = mountDialog()
    await field(wrapper, VOICE.labels.marginTop).setValue('99')
    await field(wrapper, VOICE.labels.marginTop).setValue('2')
    const { min, max } = CALIBRATION_LIMITS.marginTopMm
    expect(wrapper.text()).not.toContain(VOICE.labels.rangeError(min, max))
  })

  it('cuando cambia la calibración de fuera (p. ej. Restaurar) los campos se actualizan', async () => {
    const wrapper = mountDialog({ calibration: CALIBRATED })
    await wrapper.setProps({ calibration: { ...DEFAULT_CALIBRATION } })
    for (const [key, label] of LABELS) expect(inputOf(wrapper, label).value).toBe(String(DEFAULT_CALIBRATION[key]))
  })

  it('"Restaurar valores por defecto" emite reset', async () => {
    const wrapper = mountDialog()
    await button(wrapper, 'Restaurar valores por defecto')!.trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('avisa cuando la última fila o la última columna se salen de la hoja', () => {
    expect(mountDialog().text()).not.toContain('se sale')
    const bottom = mountDialog({ calibration: { ...DEFAULT_CALIBRATION, pitchYMm: 30 } })
    expect(bottom.text()).toContain(VOICE.labels.overflowBottom(28.7))
    const right = mountDialog({ calibration: { ...DEFAULT_CALIBRATION, marginLeftMm: 10 } })
    expect(right.text()).toContain(VOICE.labels.overflowRight(0.6))
  })
})

describe('LabelPrintDialog — ayuda', () => {
  it('explica imprimir al 100 %, no ajustar a la página y calibrar en papel normal a contraluz', () => {
    const text = mountDialog().text()
    expect(text).toContain('100 %')
    expect(text).toContain('Ajustar a la página')
    expect(text).toContain('papel normal')
    expect(text).toContain('contraluz')
    expect(text).toContain('Carta')
    expect(text).toContain('30 etiquetas')
  })
})

describe('LabelPrintDialog — acciones', () => {
  it('Vista previa y Descargar PDF emiten sus eventos', async () => {
    const wrapper = mountDialog()
    await button(wrapper, VOICE.labels.preview)!.trigger('click')
    await button(wrapper, VOICE.labels.download)!.trigger('click')
    expect(wrapper.emitted('preview')).toHaveLength(1)
    expect(wrapper.emitted('download')).toHaveLength(1)
  })

  // Con `loading` el botón cambia su texto por un indicador de carga: se ubican por posición.
  const actionButtons = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('.label-print-dialog__actions button')

  it('mientras genera: botones deshabilitados y mensaje de trabajo', () => {
    const wrapper = mountDialog({ busy: 'download' })
    const [preview, download] = actionButtons(wrapper)
    expect(preview!.attributes('disabled')).toBeDefined()
    expect(download!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain(VOICE.labels.working)
  })

  it('con un error de calibración pendiente no deja generar con un valor a medias', async () => {
    const wrapper = mountDialog()
    await field(wrapper, VOICE.labels.marginTop).setValue('99')
    const [preview, download] = actionButtons(wrapper)
    expect(preview!.attributes('disabled')).toBeDefined()
    expect(download!.attributes('disabled')).toBeDefined()
  })

  it('muestra el error de generación', () => {
    const wrapper = mountDialog({ error: VOICE.labels.printError })
    expect(wrapper.text()).toContain(VOICE.labels.printError)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('cierra con update:modelValue false', async () => {
    const wrapper = mountDialog()
    const close = wrapper.findAll('button').find((b) => /cerrar/i.test(b.attributes('aria-label') ?? b.text()))
    expect(close).toBeTruthy()
    await close!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })
})
