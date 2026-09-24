import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import BudgetView from '@/views/budget/BudgetView.vue'

describe('BudgetView', () => {
  it('monta sin errores', () => {
    const wrapper = shallowMount(BudgetView)
    expect(wrapper.exists()).toBe(true)
  })
})
