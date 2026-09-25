import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppPagination from '../ui/molecules/AppPagination.vue'

describe('AppPagination', () => {
  it('no se muestra con una sola página', () => {
    const wrapper = mount(AppPagination, { props: { currentPage: 1, totalPages: 1 } })
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('emite la página pedida', async () => {
    const wrapper = mount(AppPagination, { props: { currentPage: 2, totalPages: 5 } })
    await wrapper.get('[aria-label="Página siguiente"]').trigger('click')
    expect(wrapper.emitted('update:currentPage')?.[0]).toEqual([3])
  })

  it('el tamaño por defecto es md', () => {
    const wrapper = mount(AppPagination, { props: { currentPage: 1, totalPages: 3 } })
    expect(wrapper.get('nav').classes()).toContain('app-pagination--md')
    expect(wrapper.get('nav').classes()).not.toContain('app-pagination--lg')
  })

  it('size="lg" marca la variante táctil y sigue funcionando igual', async () => {
    const wrapper = mount(AppPagination, { props: { currentPage: 1, totalPages: 3, size: 'lg' } })
    expect(wrapper.get('nav').classes()).toContain('app-pagination--lg')
    await wrapper.get('[aria-label="Página siguiente"]').trigger('click')
    expect(wrapper.emitted('update:currentPage')?.[0]).toEqual([2])
  })
})
