import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LabelPrintDialog from '../LabelPrintDialog.vue'
import { VOICE } from '@/config/voice'
import { DEFAULT_CALIBRATION, type LabelCalibration } from '@/utils/label-sheet-plan'

// AppModal usa <Teleport to="body">: se stubea para consultar el contenido.
const mountOptions = { global: { stubs: { teleport: true } } }

function mountDialog(props: Partial<{ labelCount: number; calibration: LabelCalibration; busy: 'preview' | 'download' | null; error: string }> = {}) {
  return mount(LabelPrintDialog, {
    props: { modelValue: true, labelCount: 10, calibration: { ...DEFAULT_CALIBRATION }, busy: null, error: '', ...props },
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

describe('LabelPrintDialog — resumen de hojas', () => {
  it.each([
    [1, '1 etiqueta', '1 hoja'],
    [10, '10 etiquetas', '1 hoja'],
    [72, '72 etiquetas', '1 hoja'],
    [73, '73 etiquetas', '2 hojas'],
    [144, '144 etiquetas', '2 hojas'],
    [145, '145 etiquetas', '3 hojas'],
  ])('%i etiquetas -> "%s" y "%s"', (count, labels, sheets) => {
    const text = mountDialog({ labelCount: count }).text()
    expect(text).toContain(labels)
    expect(text).toContain('72 etiquetas por hoja')
    expect(text).toContain(sheets)
  })
})

describe('LabelPrintDialog — calibración', () => {
  it('muestra los tres campos con sus valores', () => {
    const wrapper = mountDialog({ calibration: { offsetTopMm: 1.5, offsetLeftMm: -0.8, rowPitchMm: 24.75 } })
    expect(inputOf(wrapper, VOICE.labels.offsetTop).value).toBe('1.5')
    expect(inputOf(wrapper, VOICE.labels.offsetLeft).value).toBe('-0.8')
    expect(inputOf(wrapper, VOICE.labels.rowPitch).value).toBe('24.75')
  })

  it('los campos son numéricos con paso de 0.1 (márgenes) y 0.05 (alto de fila) y rangos', () => {
    const wrapper = mountDialog()
    const top = inputOf(wrapper, VOICE.labels.offsetTop)
    expect(top.type).toBe('number')
    expect(top.step).toBe('0.1')
    expect(top.min).toBe('-10')
    expect(top.max).toBe('10')
    expect(inputOf(wrapper, VOICE.labels.rowPitch).step).toBe('0.05')
  })

  it('un valor válido (negativos y decimales incluidos) se emite como cambio parcial', async () => {
    const wrapper = mountDialog()
    await field(wrapper, VOICE.labels.offsetTop).setValue('-1.2')
    await field(wrapper, VOICE.labels.offsetLeft).setValue('0.4')
    await field(wrapper, VOICE.labels.rowPitch).setValue('25')
    expect(wrapper.emitted('update:calibration')).toEqual([
      [{ offsetTopMm: -1.2 }], [{ offsetLeftMm: 0.4 }], [{ rowPitchMm: 25 }],
    ])
  })

  it.each(['', 'abc', '99', '-99'])('un valor inválido (%j) muestra el rango y NO se emite', async (bad) => {
    const wrapper = mountDialog()
    await field(wrapper, VOICE.labels.offsetTop).setValue(bad)
    expect(wrapper.emitted('update:calibration')).toBeUndefined()
    expect(wrapper.text()).toContain(VOICE.labels.rangeError(-10, 10))
  })

  it('el error del alto de fila usa su propio rango', async () => {
    const wrapper = mountDialog()
    await field(wrapper, VOICE.labels.rowPitch).setValue('5')
    expect(wrapper.text()).toContain(VOICE.labels.rangeError(20, 26))
  })

  it('el error desaparece al escribir un valor válido', async () => {
    const wrapper = mountDialog()
    await field(wrapper, VOICE.labels.offsetTop).setValue('99')
    await field(wrapper, VOICE.labels.offsetTop).setValue('2')
    expect(wrapper.text()).not.toContain(VOICE.labels.rangeError(-10, 10))
  })

  it('cuando cambia la calibración de fuera (p. ej. Restablecer) los campos se actualizan', async () => {
    const wrapper = mountDialog({ calibration: { offsetTopMm: 3, offsetLeftMm: 3, rowPitchMm: 25 } })
    await wrapper.setProps({ calibration: { ...DEFAULT_CALIBRATION } })
    expect(inputOf(wrapper, VOICE.labels.offsetTop).value).toBe('0')
    expect(inputOf(wrapper, VOICE.labels.rowPitch).value).toBe('24.75')
  })

  it('"Restablecer" emite reset', async () => {
    const wrapper = mountDialog()
    await button(wrapper, VOICE.labels.reset)!.trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('avisa cuando el alto de fila hace que la última fila se salga de la hoja', () => {
    expect(mountDialog().text()).not.toContain('se sale')
    const overflow = mountDialog({ calibration: { offsetTopMm: 0, offsetLeftMm: 0, rowPitchMm: 25 } })
    expect(overflow.text()).toContain(VOICE.labels.overflow(3))
  })
})

describe('LabelPrintDialog — ayuda', () => {
  it('explica imprimir al 100 %, no ajustar a la página, calibrar con una hoja de prueba y el 25 vs 24,75', () => {
    const text = mountDialog().text()
    expect(text).toContain('100 %')
    expect(text).toContain('Ajustar a la página')
    expect(text).toContain('UNA en papel normal')
    expect(text).toContain('24,75')
    expect(text).toContain('300 mm')
    expect(text).toContain('297 mm')
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
    await field(wrapper, VOICE.labels.offsetTop).setValue('99')
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
