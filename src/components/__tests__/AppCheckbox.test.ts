// Tests del átomo AppCheckbox — alcanzable con el teclado
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppCheckbox from '@/components/ui/atoms/AppCheckbox.vue'
import source from '@/components/ui/atoms/AppCheckbox.vue?raw'

describe('AppCheckbox', () => {
  it('emite el estado nuevo al marcar', async () => {
    const wrapper = mount(AppCheckbox, { props: { modelValue: false } })

    await wrapper.get('input').setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('el input real no se oculta con display:none (así sigue en el orden del teclado)', () => {
    const rule = /\.app-checkbox__input\s*\{([^}]*)\}/.exec(source)
    expect(rule).not.toBeNull()
    expect(rule![1]).not.toMatch(/display\s*:\s*none/)
    expect(rule![1]).not.toMatch(/visibility\s*:\s*hidden/)
  })

  it('al enfocarlo con el teclado se ve un anillo de foco sobre la caja', () => {
    expect(source).toMatch(/\.app-checkbox__input:focus-visible\s*~\s*\.app-checkbox__box\s*\{[^}]*outline/)
  })
})
