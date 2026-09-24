import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const routeMock = { params: {} as Record<string, string> }
vi.mock('vue-router', () => ({
  useRoute:   () => routeMock,
  RouterLink: { template: '<a><slot /></a>' },
}))

import GuideView from '@/views/guide/GuideView.vue'

describe('GuideView', () => {
  it('se monta sin errores', () => {
    const wrapper = shallowMount(GuideView)
    expect(wrapper.exists()).toBe(true)
  })

  it('categoriesInOrder devuelve exactamente 3 categorías en el orden correcto', () => {
    const wrapper = shallowMount(GuideView)
    const vm = wrapper.vm as any
    expect(vm.categoriesInOrder).toHaveLength(3)
    expect(vm.categoriesInOrder[0].key).toBe('conceptos')
    expect(vm.categoriesInOrder[1].key).toBe('sistema')
    expect(vm.categoriesInOrder[2].key).toBe('seguridad')
  })

  it('currentArticle es undefined cuando no hay slug en la ruta', () => {
    routeMock.params = {}
    const wrapper = shallowMount(GuideView)
    const vm = wrapper.vm as any
    expect(vm.currentArticle).toBeUndefined()
  })

  it('currentArticle resuelve el artículo correcto cuando hay slug válido', () => {
    // 'regla-50-30-20' es un slug real de guide.data
    routeMock.params = { slug: 'regla-50-30-20' }
    const wrapper = shallowMount(GuideView)
    const vm = wrapper.vm as any
    expect(vm.currentArticle).toBeDefined()
    expect(vm.currentArticle.slug).toBe('regla-50-30-20')
  })

  it('currentArticle es undefined con slug que no existe', () => {
    routeMock.params = { slug: 'slug-inexistente-xyz' }
    const wrapper = shallowMount(GuideView)
    const vm = wrapper.vm as any
    expect(vm.currentArticle).toBeUndefined()
  })

  it('prev y next son undefined cuando no hay artículo activo', () => {
    routeMock.params = {}
    const wrapper = shallowMount(GuideView)
    const vm = wrapper.vm as any
    expect(vm.prev).toBeUndefined()
    expect(vm.next).toBeUndefined()
  })

  it('relatedArticles es array vacío cuando no hay artículo activo', () => {
    routeMock.params = {}
    const wrapper = shallowMount(GuideView)
    const vm = wrapper.vm as any
    expect(vm.relatedArticles).toEqual([])
  })

  it('sidebarOpen empieza en false', () => {
    const wrapper = shallowMount(GuideView)
    const vm = wrapper.vm as any
    expect(vm.sidebarOpen).toBe(false)
  })

  it('relatedArticles retorna los artículos relacionados de un artículo con related definido', () => {
    routeMock.params = { slug: 'capital-vs-interes' }
    const wrapper = shallowMount(GuideView)
    const vm = wrapper.vm as any
    // 'capital-vs-interes' tiene related: ['tasa-anual-vs-mensual', 'desglose-pago']
    expect(vm.relatedArticles.length).toBeGreaterThan(0)
    expect(vm.relatedArticles.every((a: any) => !!a.slug)).toBe(true)
  })
})
