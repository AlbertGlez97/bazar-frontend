import { describe, expect, it } from 'vitest'
import { h3, list, p, section } from '../blocks'

describe('ayudantes de bloques legales', () => {
  it('p y h3 arman el bloque tipado', () => {
    expect(p('Hola')).toEqual({ kind: 'p', text: 'Hola' })
    expect(h3('Título')).toEqual({ kind: 'h3', text: 'Título' })
  })

  it('list: sin "ordered" no lo escribe; con él, sí (true o false)', () => {
    expect(list(['a', 'b'])).toEqual({ kind: 'list', items: ['a', 'b'] })
    expect('ordered' in list(['a'])).toBe(false)
    expect(list(['a'], true)).toEqual({ kind: 'list', items: ['a'], ordered: true })
    expect(list(['a'], false)).toEqual({ kind: 'list', items: ['a'], ordered: false })
  })

  it('section: cada texto suelto es un párrafo y los bloques armados pasan tal cual, en orden', () => {
    const items = list(['x'])
    expect(section('id-1', 'Título', 'Uno', h3('Sub'), 'Dos', items)).toEqual({
      id: 'id-1',
      title: 'Título',
      blocks: [{ kind: 'p', text: 'Uno' }, { kind: 'h3', text: 'Sub' }, { kind: 'p', text: 'Dos' }, items],
    })
  })

  it('section sin contenido da una lista de bloques vacía', () => {
    expect(section('a', 'B').blocks).toEqual([])
  })
})
