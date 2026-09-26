import { describe, expect, it } from 'vitest'
import { SETTINGS_ITEMS, getSettingsItems, type SettingsItemDef } from '../settings-items'

const sample: SettingsItemDef[] = [
  { to: '/app/ajustes/a', label: 'Para todos', hint: 'a', icon: '🔑' },
  { to: '/app/ajustes/b', label: 'Solo socios', hint: 'b', icon: '👥', socioOnly: true },
]

describe('getSettingsItems', () => {
  it('sin contexto (o sin ser socio) solo devuelve lo que ve cualquier persona', () => {
    expect(getSettingsItems({}, sample).map((i) => i.to)).toEqual(['/app/ajustes/a'])
    expect(getSettingsItems({ isSocio: false }, sample).map((i) => i.to)).toEqual(['/app/ajustes/a'])
    expect(getSettingsItems(undefined, sample).map((i) => i.to)).toEqual(['/app/ajustes/a'])
  })

  it('un socio ve también las entradas de socios, en el orden declarado', () => {
    expect(getSettingsItems({ isSocio: true }, sample).map((i) => i.to)).toEqual(['/app/ajustes/a', '/app/ajustes/b'])
  })

  it('solo isSocio === true cuenta como socio (nada de valores truthy)', () => {
    expect(getSettingsItems({ isSocio: 'yes' as unknown as boolean }, sample).map((i) => i.to)).toEqual(['/app/ajustes/a'])
  })
})

describe('SETTINGS_ITEMS', () => {
  it('"Cambiar mi contraseña" está para todas las personas', () => {
    const password = SETTINGS_ITEMS.find((i) => i.to === '/app/ajustes/contrasena')
    expect(password).toBeDefined()
    expect(password?.label).toBe('Cambiar mi contraseña')
    expect(password?.socioOnly).toBeFalsy()
  })

  it('"Mi equipo" es solo para socios', () => {
    const team = SETTINGS_ITEMS.find((i) => i.to === '/app/ajustes/equipo')
    expect(team).toBeDefined()
    expect(team?.label).toBe('Mi equipo')
    expect(team?.socioOnly).toBe(true)
  })

  it('un colaborador ve solo lo suyo y un socio ve también el equipo', () => {
    expect(getSettingsItems({ isSocio: false }).map((i) => i.label)).toEqual(['Cambiar mi contraseña'])
    expect(getSettingsItems({ isSocio: true }).map((i) => i.label)).toContain('Mi equipo')
  })

  it('todas viven bajo /app/ajustes, con texto de ayuda e ícono', () => {
    for (const item of SETTINGS_ITEMS) {
      expect(item.to.startsWith('/app/ajustes/')).toBe(true)
      expect(item.hint.length).toBeGreaterThan(0)
      expect(item.icon.length).toBeGreaterThan(0)
    }
  })

  it('no repite rutas', () => {
    const paths = SETTINGS_ITEMS.map((i) => i.to)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
