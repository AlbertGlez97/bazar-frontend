// Aviso de "Disponible / Comprometido / Libre" al crear un acuerdo.
import { describe, expect, it } from 'vitest'
import { agreementErrorMessage, commitmentNotice, validCommitment } from '../finance-agreements'

const commitment = (over = {}) => ({
  from: '2026-10-01', to: '2026-11-01', availableMinor: 1_000_000, committedMinor: 600_000, freeMinor: 400_000, agreementCount: 1, ...over,
})

describe('commitmentNotice', () => {
  it('cabe: lo pedido es menor o igual a lo libre', () => {
    expect(commitmentNotice(commitment(), 400_000)).toMatchObject({ fits: true, missingMinor: 0, message: '' })
    expect(commitmentNotice(commitment(), 1)).toMatchObject({ fits: true })
  })

  it('un centavo de más ya no cabe y dice cuánto falta', () => {
    const notice = commitmentNotice(commitment(), 400_001)
    expect(notice.fits).toBe(false)
    expect(notice.missingMinor).toBe(1)
    expect(notice.message).toContain('Faltan $0.01.')
  })

  it('explica con las cifras y qué hacer, en español sencillo', () => {
    expect(commitmentNotice(commitment(), 600_000).message).toBe(
      'No alcanza. Este acuerdo pide $6,000.00 y solo quedan $4,000.00 libres. Faltan $2,000.00. Hay $10,000.00 disponibles y $6,000.00 ya están comprometidos en otros acuerdos vigentes. Baja el monto o anula un acuerdo vigente de este período.',
    )
  })

  it('sin nada libre', () => {
    const notice = commitmentNotice(commitment({ committedMinor: 1_000_000, freeMinor: 0 }), 50)
    expect(notice.fits).toBe(false)
    expect(notice.message).toContain('solo quedan $0.00 libres')
  })
})

describe('validCommitment', () => {
  it('acepta la forma del servidor', () => {
    expect(validCommitment(commitment())).toBe(true)
    expect(validCommitment(commitment({ availableMinor: -200_000, committedMinor: 0, freeMinor: 0, agreementCount: 0 }))).toBe(true)
  })

  it.each([
    null, 'x', {}, commitment({ freeMinor: 1.5 }), commitment({ committedMinor: -1 }), commitment({ freeMinor: -1 }),
    commitment({ agreementCount: -1 }), commitment({ from: '2026-02-30' }), commitment({ from: '2026-11-01', to: '2026-10-01' }),
    commitment({ freeMinor: 999_999_999 }), commitment({ availableMinor: '1' }),
  ])('rechaza %j', (value) => {
    expect(validCommitment(value)).toBe(false)
  })
})

describe('error del servidor por no alcanzar', () => {
  it('usa el mensaje en español que manda el servidor', () => {
    const message = 'No alcanza el disponible del período: hay $10,000.00 disponibles.'
    expect(agreementErrorMessage({ response: { status: 422, data: { code: 'FINANCE_AGREEMENT_EXCEEDS_UNCOMMITTED', message } } })).toBe(message)
  })

  it('si no trae mensaje, un texto propio con la misma idea', () => {
    expect(agreementErrorMessage({ response: { status: 422, data: { code: 'FINANCE_AGREEMENT_EXCEEDS_UNCOMMITTED' } } })).toContain('No alcanza el disponible')
  })

  it('un mensaje con otro código no se muestra tal cual (inglés del servidor)', () => {
    expect(agreementErrorMessage({ response: { status: 422, data: { code: 'OTHER', message: 'INTERNAL ENGLISH' } } })).not.toContain('INTERNAL')
  })
})
