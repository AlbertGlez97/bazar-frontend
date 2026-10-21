import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RulesCorreoCard from '../RulesCorreoCard.vue'
import { AppInput } from '@/components'

const card = (props: Partial<InstanceType<typeof RulesCorreoCard>['$props']> = {}) =>
  mount(RulesCorreoCard, { props: { pending: null, sentTo: '', working: false, ...props } })
/** Escribe como lo haría el campo: sin pasar por el navegador, que ya recorta los espacios de un campo de correo. */
const write = async (w: ReturnType<typeof card>, value: string) => {
  w.findComponent(AppInput).vm.$emit('update:modelValue', value)
  await w.vm.$nextTick()
}

describe('RulesCorreoCard', () => {
  it('explica para qué es el correo y que se confirma con un enlace, con frases cortas', () => {
    const w = card()
    expect(w.get('h3').text()).toBe('Escribe tu correo')
    expect(w.text()).toContain('Las reglas por aprobar llegan a tu correo. Escríbelo una sola vez.')
    expect(w.text()).toContain('Te mandamos un enlace para confirmar que es tuyo.')
    for (const sentence of w.get('p').text().split(/(?<=\.)\s+/)) expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(20)
  })

  it('manda el correo sin los espacios de los lados', async () => {
    const w = card()
    await write(w, '  ana@example.com  ')
    await w.get('form').trigger('submit')

    expect(w.emitted('submit')).toEqual([['ana@example.com']])
  })

  it.each(['', '   ', 'ana', 'ana @example.com', 'ana@ example.com'])('no manda %j y lo dice', async (typed) => {
    const w = card()
    await write(w, typed)
    await w.get('form').trigger('submit')

    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('Escribe un correo válido, por ejemplo nombre@dominio.com')
  })

  it('corregido el error, el aviso desaparece al enviar', async () => {
    const w = card()
    await write(w, 'ana')
    await w.get('form').trigger('submit')
    expect(w.text()).toContain('Escribe un correo válido')

    await write(w, 'ana@example.com')
    await w.get('form').trigger('submit')
    expect(w.text()).not.toContain('Escribe un correo válido')
    expect(w.emitted('submit')).toEqual([['ana@example.com']])
  })

  it('con una confirmación esperando, dice a qué correo y hasta cuándo; si no, dice adónde se mandó', () => {
    const waiting = card({ pending: { correo: 'a***@e***.com', expiresAt: '2026-10-23T18:00:00.000Z' }, sentTo: 'x***@e***.com' })
    expect(waiting.get('[data-test="rules-correo-pending"]').text()).toBe(
      'Ya enviamos un correo a a***@e***.com. Ábrelo y confirma. Vence el 23/10/2026, 12:00. Si no llegó, escríbelo de nuevo.',
    )
    expect(waiting.find('[data-test="rules-correo-sent"]').exists()).toBe(false)

    const sent = card({ sentTo: 'a***@e***.com' })
    expect(sent.get('[data-test="rules-correo-sent"]').text()).toBe('Te enviamos un correo a a***@e***.com. Ábrelo y confirma.')
    expect(card().find('[role="status"]').exists()).toBe(false)
  })

  it('mientras envía, el campo y el botón se desactivan', () => {
    const w = card({ working: true })
    expect(w.get('input').attributes('disabled')).toBeDefined()
    expect(w.get('button').attributes('disabled')).toBeDefined()
  })

  it('el campo es de correo, tiene etiqueta y autocompletado válido', () => {
    const w = card()
    const input = w.get('input')
    expect(input.attributes('type')).toBe('email')
    expect(input.attributes('autocomplete')).toBe('email')
    expect(w.get(`label[for="${input.attributes('id')}"]`).text()).toBe('Tu correo')
  })
})
