import api from './api'

export interface CategoryItem {
  id:       string
  key:      string
  label:    string
  type:     'necesidad' | 'deseo'
  isGlobal: boolean
  userId:   string | null
}

const CategoryService = {
  async getAll(): Promise<CategoryItem[]> {
    const { data } = await api.get<CategoryItem[]>('/categories')
    return data
  },

  async create(label: string, type: 'necesidad' | 'deseo'): Promise<CategoryItem> {
    const { data } = await api.post<CategoryItem>('/categories', { label, type })
    return data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/categories/${id}`)
  },
}

export default CategoryService
